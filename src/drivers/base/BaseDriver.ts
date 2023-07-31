import QueryCompiler from "../../compiler/QueryCompiler.js";
import EntityType from "../../entity-query/EntityType.js";
import Migrations from "../../migrations/Migrations.js";
import ChangeEntry from "../../model/changes/ChangeEntry.js";
import { BinaryExpression, Constant, DeleteStatement, ExistsExpression, Expression, InsertStatement, NotExits, QuotedLiteral, ReturnUpdated, SelectStatement, TableLiteral, UpdateStatement, ValuesStatement } from "../../query/ast/Expressions.js";

export const disposableSymbol: unique symbol = (Symbol as any).dispose ??= Symbol("disposable");

interface IDisposable {
    [disposableSymbol]?(): void;
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

export abstract class BaseDriver {
    abstract get compiler(): QueryCompiler;

    constructor(public readonly connectionString: IDbConnectionString) {}

    public abstract executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader>;

    public abstract executeQuery(command: IQuery, signal?: AbortSignal): Promise<IQueryResult>;

    public abstract ensureDatabase(): Promise<any>;

    public abstract runInTransaction<T = any>(fx?: () => Promise<T>): Promise<T>;

    /**
     * This migrations only support creation of missing items.
     * However, you can provide events to change existing items.
     */
    public abstract automaticMigrations(): Migrations;

    createInsertExpression(type: EntityType, entity: any): InsertStatement {
        const returnFields = [] as QuotedLiteral[];
        const fields = [] as QuotedLiteral[];
        const values = [] as Constant[];
        for (const iterator of type.columns) {
            const literal = QuotedLiteral.create({ literal: iterator.columnName });
            if (iterator.autoGenerate) {
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

        const name = QuotedLiteral.create({ literal: type.name });
        const schema = type.schema ? QuotedLiteral.create({ literal: type.schema }) : void 0;

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

    createUpsertExpression(type: EntityType, entity: any, keys: {[key: string]: any}): InsertStatement {
        const returnFields = [] as QuotedLiteral[];
        const fields = [] as QuotedLiteral[];
        const values = [] as Constant[];
        for (const iterator of type.columns) {
            const literal = QuotedLiteral.create({ literal: iterator.columnName });
            if (iterator.autoGenerate) {
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

        const name = QuotedLiteral.create({ literal: type.name });
        const schema = type.schema ? QuotedLiteral.create({ literal: type.schema }) : void 0;

        const checkParameter = Expression.parameter("check");

        let where: Expression;
        for (const key in keys) {
            if (Object.prototype.hasOwnProperty.call(keys, key)) {
                const element = keys[key];
                const column = type.getColumn(key);
                const condition = Expression.equal(
                    Expression.member(checkParameter, Expression.quotedLiteral(column.columnName) ),
                    Expression.constant(keys[key])
                );
                where = where
                    ? Expression.logicalAnd(where, condition)
                    : condition;
            }
        }

        return InsertStatement.create({
            table: TableLiteral.create({
                name,
                schema
            }),
            values: SelectStatement.create({
                source: ValuesStatement.create({ fields, values: [values] }),
                where: NotExits.create({
                    target: SelectStatement.create({
                        source: type.fullyQualifiedName,
                        sourceParameter: checkParameter,
                        fields: [Expression.identifier("1")],
                        where
                    })
                })
            }),
            returnValues: ReturnUpdated.create({
                changes: "INSERTED",
                fields: returnFields
            }),
        });
    }

    createUpdateExpression(entry: ChangeEntry) {
        const set = [] as BinaryExpression[];
        for (const [key, change] of entry.modified) {
            set.push(BinaryExpression.create({
                left: QuotedLiteral.create({ literal: key.columnName}),
                operator: "=",
                right: Constant.create({ value: change.newValue ?? null })
            }));
        }
        let where = null as Expression;
        for (const iterator of entry.type.keys) {
            const compare = BinaryExpression.create({
                left: QuotedLiteral.create({ literal: iterator.columnName }),
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
                left: QuotedLiteral.create({ literal: iterator.columnName }),
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
