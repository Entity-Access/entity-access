import EntityAccessError from "../../common/EntityAccessError.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import EntityType from "../../entity-query/EntityType.js";
import Migrations from "../../migrations/Migrations.js";
import ChangeEntry from "../../model/changes/ChangeEntry.js";
import { BinaryExpression, Constant, DeleteStatement, ExistsExpression, Expression, Identifier, InsertStatement, NotExits, ReturnUpdated, SelectStatement, TableLiteral, UnionAllStatement, UpdateStatement, ValuesStatement } from "../../query/ast/Expressions.js";

interface IDisposable {
    [Symbol.dispose]?(): void;
}

export interface IRecord {
    [key: string]: string | boolean | number | Date | Uint8Array | Blob;
}

export interface IDbConnectionString {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    poolSize?: number;
}

export interface IDbReader extends IDisposable {
    next(min?: number, signal?: AbortSignal): AsyncGenerator<IRecord, any, any>;
    dispose(): Promise<any>;
}

export const toQuery = (text: IQuery): { text: string, values?: any[]} => typeof text === "string"
    ? { text, values: [] }
    : text;

export type IQuery = string | {
    text: string;
    values?: any[];
};

export interface IQueryTask {
    query: IQuery;
    postExecution?: ((r: any) => Promise<any>);
}

export interface IQueryResult {
    rows?: any[];
    updated?: number;
}

export interface IBaseTransaction {
    commit(): Promise<any>;
    rollback(): Promise<any>;
    dispose(): Promise<any>;
}

export abstract class BaseConnection {

    protected compiler: QueryCompiler;

    protected connectionString: IDbConnectionString;

    private currentTransaction: IBaseTransaction;


    constructor(public driver: BaseDriver) {
        this.compiler = driver.compiler;
        this.connectionString = driver.connectionString;
    }

    public abstract ensureDatabase(): Promise<any>;

    /**
     * This migrations only support creation of missing items.
     * However, you can provide events to change existing items.
     */
    public abstract automaticMigrations(): Migrations;


    public abstract executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader>;

    public abstract executeQuery(command: IQuery, signal?: AbortSignal): Promise<IQueryResult>;

    public abstract createTransaction(): Promise<IBaseTransaction>;

    public async runInTransaction<T = any>(fx?: () => Promise<T>) {
        if(this.currentTransaction) {
            // nested transactions... do not worry
            // just pass through
            return await fx();
        }
        let failed = true;
        let tx: IBaseTransaction;
        try {
            tx = this.currentTransaction = await this.createTransaction();
            const result = await fx();
            await tx.commit();
            failed = false;
            return result;
        } finally {
            if (failed) {
                await tx?.rollback();
            }
            await tx?.dispose();
            this.currentTransaction = null;
        }
    }
}

export abstract class BaseDriver {
    abstract get compiler(): QueryCompiler;


    constructor(public readonly connectionString: IDbConnectionString) {}

    abstract newConnection(): BaseConnection;

    /** Must dispose ObjectPools */
    abstract dispose();

    createInsertExpression(type: EntityType, entity: any): InsertStatement {
        const returnFields = [] as Identifier[];
        const fields = [] as Identifier[];
        const values = [] as Constant[];
        for (const iterator of type.columns) {
            const literal = Identifier.create({ value: iterator.columnName });
            if (iterator.generated) {
                returnFields.push(literal);
                continue;
            }
            const value = entity[iterator.name];
            if (value === void 0) {
                continue;
            }
            fields.push(literal);
            values.push(Constant.create({ value }));
        }

        const name = Expression.identifier(type.name);
        const schema = type.schema ? Expression.identifier(type.schema) : void 0;

        return InsertStatement.create({
            table: TableLiteral.create({
                name,
                schema
            }),
            values: ValuesStatement.create({ fields, values: [values] }),
            returnValues: ReturnUpdated.create({
                changes: "INSERTED",
                fields: returnFields
            }),
        });
    }

    createUpdateExpression(entry: ChangeEntry) {
        const set = [] as BinaryExpression[];
        for (const [key, change] of entry.modified) {
            if (!key.columnName) {
                // some relations are getting into modified map
                // till the time the concrete bug is found
                // we will keep this check
                continue;
            }
            set.push(BinaryExpression.create({
                left: Expression.identifier(key.columnName),
                operator: "=",
                right: Constant.create({ value: change.newValue ?? null })
            }));
        }
        let where = null as Expression;
        for (const iterator of entry.type.keys) {
            const compare = BinaryExpression.create({
                left: Expression.identifier(iterator.columnName),
                operator: "=",
                right: Constant.create({ value: entry.entity[iterator.name]})
            });
            where = !where
                ? compare
                : BinaryExpression.create({
                    left: where,
                    operator: "AND",
                    right: compare
                });
        }
        return UpdateStatement.create({
            set,
            table: entry.type.fullyQualifiedName,
            where
        });
    }

    createDeleteExpression(type: EntityType, entity: any) {
        let where: Expression;
        for (const iterator of type.keys) {
            const key = entity[iterator.name];
            if (!key) {
                return null;
            }
            const compare = BinaryExpression.create({
                left: Expression.identifier(iterator.columnName),
                operator: "=",
                right: Constant.create({ value: key })
            });
            where = where
                ? BinaryExpression.create({ left: where, operator: "AND", right: compare })
                : compare;
        }
        if (!where) {
            return null;
        }
        return DeleteStatement.create({
            table: type.fullyQualifiedName,
            where
        });
    }


}
