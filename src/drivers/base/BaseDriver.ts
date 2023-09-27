import EntityAccessError from "../../common/EntityAccessError.js";

// Making sure that Symbol.dispose is not undefined
import "../../common/IDisposable.js";

import QueryCompiler from "../../compiler/QueryCompiler.js";
import EntityType from "../../entity-query/EntityType.js";
import Migrations from "../../migrations/Migrations.js";
import ChangeEntry from "../../model/changes/ChangeEntry.js";
import { BinaryExpression, Constant, DeleteStatement, ExistsExpression, Expression, Identifier, InsertStatement, NotExits, ReturnUpdated, SelectStatement, TableLiteral, UnionAllStatement, UpdateStatement, UpsertStatement, ValuesStatement } from "../../query/ast/Expressions.js";

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

export interface IDbReader {
    next(min?: number, signal?: AbortSignal): AsyncGenerator<IRecord, any, any>;
    dispose(): Promise<any>;
    [Symbol.asyncDispose](): Promise<void>;
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
    dispose(): Promise<void>;
}

export class EntityTransaction {

    committedOrRolledBack = false;

    constructor(private tx: IBaseTransaction) {}

    commit() {
        this.committedOrRolledBack = true;
        return this.tx.commit();
    }

    rollback() {
        this.committedOrRolledBack = true;
        return this.tx.rollback();
    }

    async dispose() {
        if(!this.committedOrRolledBack) {
            await this.tx.commit();
        }
        await this.tx.dispose();
    }

    async [Symbol.asyncDispose]() {
        if(!this.committedOrRolledBack) {
            await this.tx.commit();
        }
        await this.tx.dispose();
    }
}

export abstract class BaseConnection {

    protected compiler: QueryCompiler;

    protected connectionString: IDbConnectionString;

    private currentTransaction: EntityTransaction;


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

    public abstract createTransaction(): Promise<EntityTransaction>;

    public async runInTransaction<T = any>(fx?: () => Promise<T>) {
        if(this.currentTransaction) {
            // nested transactions... do not worry
            // just pass through
            return await fx();
        }
        let failed = true;
        let tx: EntityTransaction;
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
            await tx?.[Symbol.asyncDispose]();
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

    createUpsertExpression(type: EntityType, entity: any, mode: "update" | "upsert" | "insert"): Expression {
        const table = type.fullyQualifiedName as TableLiteral;

        if (mode === "insert") {
            const fields = [];
            const values = [];
            for (const iterator of type.columns) {
                const value = entity[iterator.name];
                if (value === void 0) {
                    continue;
                }
                fields.push(Expression.identifier(iterator.columnName));
                values.push(Expression.constant(value));
            }
            return InsertStatement.create({
                table,
                values: ValuesStatement.create({
                    fields,
                    values: [values]
                })
            });
        }


        const insert = [] as BinaryExpression[];
        const update = [] as BinaryExpression[];
        const keys = [] as BinaryExpression[];
        for (const iterator of type.columns) {
            const value = entity[iterator.name];
            const assign = Expression.assign(
                Expression.identifier(iterator.columnName),
                Expression.constant(value)
            );
            if (iterator.key) {
                keys.push(assign);
                insert.push(assign);
                continue;
            }
            if (value === undefined) {
                continue;
            }
            insert.push(assign);
            if (value === undefined) {
                continue;
            }
            update.push(assign);
        }


        if (mode === "update") {
            let where = null;
            for (const iterator of keys) {
                where = where ? Expression.logicalAnd(where, iterator) : iterator;
            }
            return UpdateStatement.create({
                table,
                set: update,
                where
            });
        }

        return UpsertStatement.create({
            table,
            insert,
            update,
            keys
        });
    }

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
