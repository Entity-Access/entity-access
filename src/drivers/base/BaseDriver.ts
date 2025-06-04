import EntityAccessError from "../../common/EntityAccessError.js";
import IColumnSchema from "../../common/IColumnSchema.js";

// Making sure that Symbol.dispose is not undefined
import "../../common/IDisposable.js";

import QueryCompiler from "../../compiler/QueryCompiler.js";
import { IColumn } from "../../decorators/IColumn.js";
import EntityType from "../../entity-query/EntityType.js";
import Migrations from "../../migrations/Migrations.js";
import ChangeEntry, { IChange } from "../../model/changes/ChangeEntry.js";
import { BinaryExpression, Constant, DeleteStatement, Expression, Identifier, InsertStatement, ReturnUpdated, SelectStatement, TableLiteral, UpdateStatement, UpsertStatement, ValuesStatement } from "../../query/ast/Expressions.js";
import { Query } from "../../query/Query.js";

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

const currentTransaction = Symbol("currentTransaction");

export abstract class EntityTransaction {

    private committedOrRolledBack = false;

    private disposed = false;
    private old: EntityTransaction;

    constructor(protected conn: BaseConnection) {
        const old = conn[currentTransaction];
        this.old = old;
        conn[currentTransaction] = this;
    }

    begin() {
        return this.beginTransaction();
    }

    async commit() {
        if (this.committedOrRolledBack) {
            throw new EntityAccessError("Transaction is already committed or rolled back. But not disposed");
        }
        this.committedOrRolledBack = true;
        await this.commitTransaction();
        await this.dispose();
    }

    async rollback() {
        if (this.committedOrRolledBack) {
            throw new EntityAccessError("Transaction is already committed or rolled back. But not disposed");
        }
        this.committedOrRolledBack = true;
        await this.rollbackTransaction();
        await this.dispose();
    }

    save(id) {
        return this.saveTransaction(id);
    }

    rollbackTo(id) {
        return this.rollbackToTransaction(id);
    }

    async dispose() {
        if (this.disposed) {
            return;
        }
        this.conn[currentTransaction] = this.old;
        this.disposed = true;
        if(!this.committedOrRolledBack) {
            await this.rollbackTransaction();
        }
        await this.disposeTransaction();
    }

    [Symbol.asyncDispose]() {
        return this.dispose();
    }

    protected abstract saveTransaction(id): Promise<void>;

    protected abstract rollbackToTransaction(id): Promise<void>;

    protected abstract disposeTransaction(): Promise<void>;

    protected abstract commitTransaction(): Promise<void>;

    protected abstract rollbackTransaction(): Promise<void>;

    protected abstract beginTransaction(): Promise<void>;

}

const emptyResolve = Promise.resolve();

class EmptyTransaction extends EntityTransaction {

    constructor(a, private parent: EntityTransaction) {
        super(a);
    }

    protected saveTransaction(id: any): Promise<void> {
        return this.parent?.save(id);
    }
    protected rollbackToTransaction(id: any): Promise<void> {
        return this.parent?.rollbackTo(id);
    }

    protected disposeTransaction() {
        return emptyResolve;
    }
    protected commitTransaction() {
        return emptyResolve;
    }
    protected rollbackTransaction() {
        return emptyResolve;
    }

    protected beginTransaction() {
        return emptyResolve;
    }

}

export abstract class BaseConnection {

    public get currentTransaction() {
        return this[currentTransaction];
    }

    protected compiler: QueryCompiler;

    protected connectionString: IDbConnectionString;

    private [currentTransaction]: EntityTransaction;


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

    public async runInTransaction<T = any>(fx?: () => Promise<T>) {
        await using tx = await this.createTransaction();
        const result = await fx();
        await tx.commit();
        return result;
    }

    public createQuery(query: Query) {
        const { compiler } = this.driver;
        return query.toQuery(void 0, compiler.quote);
    }

    public abstract executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader>;

    public abstract executeQuery(command: IQuery, signal?: AbortSignal): Promise<IQueryResult>;

    public async createTransaction() {
        const ctx = this[currentTransaction];
        if (ctx) {
            // return fake one...
            return new EmptyTransaction(this, ctx);
        }
        const tx = await this.createDbTransaction();
        await tx.begin();
        return tx;
    }

    abstract getSchema(schema: string, table: string): Promise<IColumnSchema[]>;


    protected abstract createDbTransaction(): Promise<EntityTransaction>;

}

export type DirectSaveType =
/**
 * Inserts given item and returns generated columns
 */
    "insert" |
/**
 * Updates given item and returns generated columns
 */
    "update" |
/**
 * Inserts if not exists or update and returns generated columns for given keys
 */
    "upsert"|
/**
 * Inserts if not exists or selects generated columns for given keys
 */
"selectOrInsert" |
/**
 * Deletes the record with keys provided.*/
"delete";

export abstract class BaseDriver {
    abstract get compiler(): QueryCompiler;


    constructor(public readonly connectionString: IDbConnectionString) {}

    abstract newConnection(): BaseConnection;

    /** Must dispose ObjectPools */
    abstract dispose();

    abstract insertQuery(type: EntityType, entity): { text: string, values: any[] };

    updateQuery(type: EntityType, entity: any, changes?: Map<IColumn, IChange>, keys?: any): { text: string; values: any[]; } {
        let where = "";
        let setParams = "";
        let returning = "";
        const values = [];
        let i = 1;
        if (changes) {
            for (const [iterator, value] of changes.entries()) {
                if (iterator.computed) {
                    if (returning) {
                        returning += ",";
                    }
                    returning += `${iterator.quotedColumnName} as ${iterator.quotedName}`;
                    continue;
                }
                if (!iterator.quotedColumnName) {
                    continue;
                }
                if (setParams) {
                    setParams += ",\r\n\t\t";
                }
                setParams += `${iterator.quotedColumnName} = $${i++}`;
                values.push(value.newValue);
            }
            if (keys) {
                for (const key of Object.keys(keys)) {
                    const iterator = type.getField(key);
                    if (!iterator) {
                        continue;
                    }
                    if(where) {
                        where += "\r\n\t\tAND ";
                    }
                    const compare = keys[iterator.name];
                    if (compare === null) {
                        where += `${iterator.quotedColumnName} is null`;
                        continue;
                    }
                    where += `${iterator.quotedColumnName} = $${i++}`;
                    values.push(compare);
                }
            } else {
                for (const iterator of type.keys) {
                    if(where) {
                        where += "\r\n\t\tAND ";
                    }
                    const compare = entity[iterator.name];
                    if (compare === null) {
                        where += `${iterator.quotedColumnName} is null`;
                        continue;
                    }

                    where += `${iterator.quotedColumnName} = $${i++}`;
                    values.push(compare);
                    continue;
                }
            }
        } else {
            for (const iterator of type.nonKeys) {
                const value = entity[iterator.name];
                if (value === void 0) {
                    continue;
                }
                if (setParams) {
                    setParams += ",\r\n\t\t";
                }
                setParams += `${iterator.quotedColumnName} = $${i++}`;
                values.push(value);
            }
            if (keys) {
                for (const key of Object.keys(keys)) {
                    const iterator = type.getField(key);
                    if (!iterator) {
                        continue;
                    }
                    if(where) {
                        where += "\r\n\t\tAND ";
                    }
                    const compare = keys[iterator.name];
                    if (compare === null) {
                        where += `${iterator.quotedColumnName} is null`;
                        continue;
                    }
                    where += `${iterator.quotedColumnName} = $${i++}`;
                    values.push(compare);
                }
            } else {
                for (const iterator of type.keys) {
                    if(where) {
                        where += "\r\n\t\tAND ";
                    }
                    const compare = entity[iterator.name];
                    if (compare === null) {
                        where += `${iterator.quotedColumnName} is null`;
                        continue;
                    }
                    where += `${iterator.quotedColumnName} = $${i++}`;
                    values.push(compare);
                }
            }
        }
        const text = `UPDATE ${type.fullyQualifiedTableName}\r\n\tSET ${setParams}\r\n\tWHERE ${where}`;
        return { text, values };
    }

    deleteQuery(type: EntityType, entity: any): { text: string; values: any[]; } {
        let where = "";
        const values = [];
        let i = 1;
        for (const iterator of type.keys) {
            if(where) {
                where += "\r\n\t\tAND ";
            }
            where += `${iterator.quotedColumnName} = $${i++}`;
            values.push(entity[iterator.name]);
        }
        const text = `DELETE FROM ${type.fullyQualifiedTableName}\r\n\tWHERE ${where}`;
        return { text, values };
    }

    selectQueryWithKeys(type: EntityType, entity, keys?) {
        let where = "";
        let columns = "";
        const values = [];
        let i = 1;
        const { quote } = this.compiler;
        for (const iterator of type.columns) {
            if (columns) {
                columns += ",\r\n\t\t";
            }
            columns += `${iterator.quotedColumnName} as ${iterator.quotedName}`;
        }
        if (keys) {
            for (const key of Object.keys(keys)) {
                const iterator = type.getField(key);
                if (!iterator) {
                    continue;
                }
                if(where) {
                    where += "\r\n\t\tAND ";
                }
                const compare = keys[iterator.name];
                if (compare === null) {
                    where += `${iterator.quotedColumnName} is null`;
                    continue;
                }

                where += `${iterator.quotedColumnName} = $${i++}`;
                values.push(compare);
            }
        } else {
            for (const iterator of type.keys) {
                if(where) {
                    where += "\r\n\t\tAND ";
                }
                const compare = entity[iterator.name];
                if (compare === null) {
                    where += `${iterator.quotedColumnName} is null`;
                    continue;
                }
                where += `${iterator.quotedColumnName} = $${i++}`;
                values.push(compare);
            }
        }
        const text = `SELECT ${columns}\r\n\tFROM ${type.fullyQualifiedTableName}\r\n\tWHERE ${where}`;
        return { text, values };
    }

    createSelectWithKeysExpression(type: EntityType, check: any, returnFields: Expression[] ) {
        let where = null as Expression;
        for (const key in check) {
            if (Object.prototype.hasOwnProperty.call(check, key)) {
                const element = check[key];
                const column = type.getField(key).quotedColumnNameExp;
                const condition = Expression.equal(column, Expression.constant(element));
                where = where
                    ? Expression.logicalAnd(where, condition)
                    : condition;
            }
        }

        const source = type.fullyQualifiedName;

        return SelectStatement.create({
            limit: 1,
            source,
            fields: returnFields,
            where
        });
    }

    createUpsertExpression(
        type: EntityType,
        entity: any,
        mode: DirectSaveType,
        test: any,
        returnFields?: Identifier[]): Expression {
        const table = type.fullyQualifiedName as TableLiteral;

        if (mode === "delete") {
            let where = null as Expression;
            for (const key in test) {
                if (Object.prototype.hasOwnProperty.call(test, key)) {
                    const element = test[key];
                    const { quotedColumnNameExp } = type.getField(key);
                    const compare = Expression.equal(quotedColumnNameExp, Expression.constant(element));
                    where = where
                        ? Expression.logicalAnd(where, compare)
                        : compare;
                }
            }

            if (!where) {
                throw new EntityAccessError(`No Keys specified`);
            }

            const deleteStatement = DeleteStatement.create({
                table,
                where
            });
            return deleteStatement;
        }

        if (mode === "insert") {
            const fields = [];
            const values = [];
            for (const iterator of type.columns) {
                const value = entity[iterator.name];
                if (value === void 0 || iterator.generated) {
                    continue;
                }
                fields.push(iterator.quotedColumnNameExp);
                values.push(Expression.constant(value));
            }
            return InsertStatement.create({
                table,
                returnValues: returnFields.length ? ReturnUpdated.create({
                    changes: "INSERTED",
                    fields: returnFields
                }) : void 0,
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
            if (value === void 0 || iterator.generated) {
                continue;
            }
            const assign = Expression.assign(
                iterator.quotedColumnNameExp,
                Expression.constant(value)
            );
            if (iterator.key) {
                insert.push(assign);
                if (!test) {
                    keys.push(assign);
                }
                continue;
            }
            insert.push(assign);
            update.push(assign);
        }

        if(test) {
            for (const key in test) {
                if (Object.prototype.hasOwnProperty.call(test, key)) {
                    const element = test[key];
                    const { quotedColumnNameExp } = type.getField(key);
                    keys.push(Expression.equal(quotedColumnNameExp, Expression.constant(element)));
                }
            }
        }

        if (mode === "update") {
            if (update.length === 0) {
                return null;
            }
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

        if (mode === "selectOrInsert") {
            update.length = 0;
        }

        return UpsertStatement.create({
            table,
            insert,
            update,
            keys,
            returnUpdated: returnFields.length ? ReturnUpdated.create({
                changes: "INSERTED",
                fields: returnFields
            }) : void 0
        });
    }

    createInsertExpression(type: EntityType, entity: any): InsertStatement {
        const returnFields = [] as Identifier[];
        const fields = [] as Identifier[];
        const values = [] as Constant[];
        for (const iterator of type.columns) {
            if (iterator.generated) {
                returnFields.push(iterator.quotedColumnNameExp);
                continue;
            }
            const value = entity[iterator.name];
            if (value === void 0) {
                continue;
            }
            fields.push(iterator.quotedColumnNameExp);
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
                left: key.quotedColumnNameExp,
                operator: "=",
                right: Constant.create({ value: change.newValue ?? null })
            }));
        }
        let where = null as Expression;
        for (const iterator of entry.type.keys) {
            const compare = BinaryExpression.create({
                left: iterator.quotedColumnNameExp,
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
                left: iterator.quotedColumnNameExp,
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
