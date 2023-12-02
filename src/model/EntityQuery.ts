import EntityAccessError from "../common/EntityAccessError.js";
import Logger from "../common/Logger.js";
import { AsyncDisposableScope } from "../common/usingAsync.js";
import { ServiceProvider } from "../di/di.js";
import { IDbReader } from "../drivers/base/BaseDriver.js";
import EntityType from "../entity-query/EntityType.js";
import { BinaryExpression, CallExpression, ExistsExpression, Expression, ExpressionAs, Identifier, InsertStatement, NewObjectExpression, NumberLiteral, OrderByExpression, ParameterExpression, SelectStatement, TableLiteral } from "../query/ast/Expressions.js";
import { ITextQuery } from "../query/ast/IStringTransformer.js";
import { QueryExpander } from "../query/expander/QueryExpander.js";
import EntityContext from "./EntityContext.js";
import type EntityModel from "./EntityModel.js";
import type { EntitySource } from "./EntitySource.js";
import { IOrderedEntityQuery, IEntityQuery } from "./IFilterWithParameter.js";
import { filteredSymbol } from "./events/FilteredExpression.js";
import RelationMapper from "./identity/RelationMapper.js";

export default class EntityQuery<T = any>
    implements IOrderedEntityQuery<T>, IEntityQuery<T> {

    public context: EntityContext;
    public type: EntityType;
    public selectStatement: SelectStatement;
    public signal?: AbortSignal;
    public traceQuery: (text: string) => void;
    public includes: any[];
    constructor (p: Partial<EntityQuery<any>>
    ) {
        // lets clone select...
        Object.setPrototypeOf(p, EntityQuery.prototype);
        return p as EntityQuery;
    }

    select(p: any, fx: any): any {
        return this.map(p, fx);
    }

    insertInTo(es: EntitySource) {
        const model = (es as any).mode as EntityType;
        const table = (es as any).model.fullyQualifiedName as TableLiteral;
        const fields = [];
        for (const iterator of this.selectStatement.fields) {
            if (iterator.type !== "ExpressionAs") {
                fields.push(iterator);
                continue;
            }
            const expAs = iterator as ExpressionAs;
            const field = model.getField(expAs.alias.value);
            if (!field) {
                throw new EntityAccessError(`Field ${expAs.alias.value} not found in ${model.name}`);
            }
            fields.push(Expression.as(expAs.expression, field.columnName));
        }
        const values = { ... this.selectStatement, fields };
        const query = InsertStatement.create({
            table,
            values
        });
        const { driver } = this.context;
        const insert = driver.compiler.compileExpression(null, query);
        return this.context.connection.executeQuery(insert, this.signal);
    }

    map(parameters: any, fx: any): any {
        const q = this.extend(parameters, fx, (select, body) => {
            const fields = [] as Expression[];
            switch(body.type) {
                case "NewObjectExpression":
                    const noe = body as NewObjectExpression;
                    for (const iterator of noe.properties) {
                        fields.push(ExpressionAs.create({
                            expression: iterator.expression,
                            alias: Expression.quotedIdentifier(iterator.alias.value)
                        }));
                    }
                    break;
                default:
                    fields.push(body);
                    break;

            }
            return { ... select, fields };
        });
        q.type = null;
        return q;
    }

    withSignal(signal: AbortSignal): any {
        return new EntityQuery({ ... this, signal });
    }

    thenBy(parameters: any, fx: any): any {
        return this.orderBy(parameters, fx);
    }
    thenByDescending(parameters: any, fx: any) {
        return this.orderByDescending(parameters, fx);
    }

    where<P>(parameters: P, fx: (p: P) => (x: T) => boolean): any {

        return this.extend(parameters, fx, (select, body) => ({
            ... select,
            where: select.where ? Expression.logicalAnd(select.where, body): body
        }));
    }

    include(p: any): any {
        return new EntityQuery({
            ... this,
            includes: this.includes ? [ ... this.includes, p] : [p]
            // selectStatement
        });
    }

    async update(p, f): Promise<number> {
        let updateQuery = new EntityQuery({ ... this, selectStatement: {
            ... this.selectStatement,
            sourceParameter: {
                ... this.selectStatement.sourceParameter
            },
            where: null,
            joins: null
        }});

        updateQuery = updateQuery.extend(p, f, (select, body) => {
            const fields = [] as Expression[];
            switch(body.type) {
                case "NewObjectExpression":
                    const noe = body as NewObjectExpression;
                    for (const iterator of noe.properties) {
                        const column = this.type.getProperty(iterator.alias.value);
                        fields.push(Expression.equal(
                            Expression.quotedIdentifier(column.field.columnName),
                            iterator.expression
                        ));
                    }
                    break;
                default:
                    fields.push(body);
                    break;

            }
            return { ... select, fields };
        });
        // q.selectStatement.updateStatement = true;


        updateQuery.selectStatement.updateStatement = true;
        const lm = updateQuery.selectStatement.sourceParameter;
        const rm = this.selectStatement.sourceParameter;
        let where = this.selectStatement.where ? { ... this.selectStatement.where }: null;
        for (const iterator of this.type.keys) {
            const compare = Expression.equal(
                Expression.member(lm, Expression.quotedIdentifier(iterator.columnName)),
                Expression.member(rm, Expression.quotedIdentifier(iterator.columnName))
            );
            where = where ? Expression.logicalAnd(where, compare) : compare;
        }
        const fields = [NumberLiteral.one];
        const target = {
            ... this.selectStatement,
            fields,
            where,
        };
        updateQuery.selectStatement.where = ExistsExpression.create({
            target
        });

        const session = this.context.logger?.newSession() ?? Logger.nullLogger;
        let query;
        try {
            query = this.context.driver.compiler.compileExpression(updateQuery, updateQuery.selectStatement);
            this.traceQuery?.(query.text);
            const r = await this.context.connection.executeQuery(query);
            return r.updated;
        } catch (error) {
            session.error(`Failed executing ${query?.text}\r\n${error.stack ?? error}`);
            throw error;
        }
    }

    async toArray(): Promise<T[]> {
        const results: T[] = [];
        for await (const iterator of this.enumerate()) {
            results.push(iterator);
        }
        return results;
    }

    async *enumerate(): AsyncGenerator<T, any, unknown> {

        await using scope = new AsyncDisposableScope();
        const session = this.context.logger?.newSession() ?? Logger.nullLogger;
        let query: { text: string, values: any[]};
        try {
            scope.register(session);
            const type = this.type;
            const signal = this.signal;

            const relationMapper = new RelationMapper(this.context.changeSet);

            const include = this.includes;
            if (include?.length > 0) {
                // since we will be streaming results...
                // it is important that we load all the
                // included entities first...
                const loaders = include.map((x) => QueryExpander.expand(this.context, { ... this.selectStatement } , x, false).map((y) => this.load(relationMapper, session, y, signal))).flat(2);
                await Promise.all(loaders);
            }

            signal?.throwIfAborted();
            let select = this.selectStatement;

            if (type && select.model) {
                select = { ... select, fields: select.model.getFieldMap(select.sourceParameter) };
            }

            query = this.context.driver.compiler.compileExpression(this, select);
            this.traceQuery?.(query.text);
            const reader = await this.context.connection.executeReader(query, signal);
            scope.register(reader);
            for await (const iterator of reader.next(10, signal)) {
                if (type) {
                    const item = type.map(iterator) as any;
                    // set identity...
                    const entry = this.context.changeSet.getEntry(item, item);
                    relationMapper.fix(entry);
                    yield entry.entity;
                    continue;
                }
                yield iterator as T;
            }

        } catch(error) {
            session.error(`Failed executing ${query?.text}\n${error.stack ?? error}`);
            throw error;
        }
    }

    async load(relationMapper: RelationMapper, session: Logger, select: SelectStatement, signal: AbortSignal) {
        let query: { text, values };
        let reader: IDbReader;
        try {
            if (select.model) {
                select = { ... select, fields: select.model.getFieldMap(select.sourceParameter) };
            }
            query = this.context.driver.compiler.compileExpression(this, select);
            this.traceQuery?.(query.text);
            reader = await this.context.connection.executeReader(query, signal);
            for await (const iterator of reader.next(10, signal)) {
                const item = select.model?.map(iterator) ?? iterator;
                const entry = this.context.changeSet.getEntry(item, item);
                relationMapper.fix(entry);
            }
        } catch (error) {
            session.error(`Failed loading ${query?.text}\n${error.stack ?? error}`);
            throw error;
        } finally {
            await reader?.dispose();
        }
    }

    async firstOrFail(): Promise<T> {
        for await(const iterator of this.limit(1).enumerate()) {
            return iterator;
        }
        throw new Error(`No records found for ${this.type?.name || "Table"}`);
    }

    async first(): Promise<T> {
        for await(const iterator of this.limit(1).enumerate()) {
            return iterator;
        }
        return null;
    }
    toQuery(): { text: string; values: any[]; } {
        return this.context.driver.compiler.compileExpression(this, this.selectStatement);
    }
    orderBy(parameters: any, fx: any): any {
        return this.extend(parameters, fx, (select, target) => ({
            ... select,
            orderBy: select.orderBy
                ? [ ... select.orderBy, OrderByExpression.create({ target})]
                : [OrderByExpression.create({ target})]
        }));
    }
    orderByDescending(parameters: any, fx: any): any {
        const descending = true;
        return this.extend(parameters, fx, (select, target) => ({
            ... select,
            orderBy: select.orderBy
                ? [ ... select.orderBy, OrderByExpression.create({ target, descending })]
                : [OrderByExpression.create({ target, descending })]
        }));
    }

    trace(traceQuery: (text: string) => void): any {
        return new EntityQuery({ ... this, traceQuery });
    }

    limit(n: number): any {
        return new EntityQuery({ ... this, selectStatement: { ... this.selectStatement, limit: n} });
    }

    offset(n: number): any {
        return new EntityQuery({ ... this, selectStatement: { ... this.selectStatement, offset: n} });
    }

    async sum(parameters?:any, fx?: any): Promise<number> {
        if (parameters !== void 0) {
            return this.map(parameters, fx).sum();
        }
        const field = this.selectStatement.fields[0];
        const select = { ... this.selectStatement, fields: [
            ExpressionAs.create({
                expression: Expression.callExpression(
                    "COALESCE",
                    Expression.callExpression("SUM", field),
                    NumberLiteral.zero),
                alias: Expression.identifier("c1")
            })
            ],
            orderBy: void 0
        };

        const nq = new EntityQuery({ ... this, selectStatement: select });

        await using scope = new AsyncDisposableScope();
        const session = this.context.logger?.newSession() ?? Logger.nullLogger;
        let query;
        try {
            query = this.context.driver.compiler.compileExpression(nq, select);
            const reader = await this.context.connection.executeReader(query);
            scope.register(reader);
            for await (const iterator of reader.next()) {
                return iterator.c1 as number;
            }
            // this is special case when database does not return any count
            // like sql server
            return 0;
        } catch (error) {
            session.error(`Failed executing ${query?.text}\r\n${error.stack ?? error}`);
            throw error;
        }

    }

    async some(): Promise<boolean> {
        // if (parameters !== void 0) {
        //     return this.where(parameters, fx).count();
        // }

        const select = { ... this.selectStatement, fields: [
            Expression.as(
                Identifier.create({ value: "1"}),
                "c1")
            ],
            orderBy: void 0
        };

        const nq = new EntityQuery({ ... this, selectStatement: select });

        await using scope = new AsyncDisposableScope();
        const session = this.context.logger?.newSession() ?? Logger.nullLogger;
        let query;
        try {
            query = this.context.driver.compiler.compileExpression(nq, select);
            this.traceQuery?.(query.text);
            const reader = await this.context.connection.executeReader(query);
            scope.register(reader);
            for await (const iterator of reader.next()) {
                if(iterator.c1 as number) {
                    return true;
                }
            }
            // this is special case when database does not return any count
            // like sql server
            return false;
        } catch (error) {
            session.error(`Failed executing ${query?.text}\r\n${error.stack ?? error}`);
            throw error;
        }

    }

    async count(parameters?:any, fx?: any): Promise<number> {
        if (parameters !== void 0) {
            return this.where(parameters, fx).count();
        }

        const select = { ... this.selectStatement, fields: [
            ExpressionAs.create({
                expression: CallExpression.create({
                    callee: Identifier.create({ value: "COUNT"}),
                    arguments: [ Identifier.create({ value: "*"})]
                }),
                alias: Expression.identifier("c1")
            })
            ],
            orderBy: void 0
        };

        const nq = new EntityQuery({ ... this, selectStatement: select });

        await using scope = new AsyncDisposableScope();
        const session = this.context.logger?.newSession() ?? Logger.nullLogger;
        let query;
        try {
            query = this.context.driver.compiler.compileExpression(nq, select);
            this.traceQuery?.(query.text);
            const reader = await this.context.connection.executeReader(query);
            scope.register(reader);
            for await (const iterator of reader.next()) {
                return iterator.c1 as number;
            }
            // this is special case when database does not return any count
            // like sql server
            return 0;
        } catch (error) {
            session.error(`Failed executing ${query?.text}\r\n${error.stack ?? error}`);
            throw error;
        }

    }

    private extend(parameters: any, fx: any, map: (select: SelectStatement, exp: Expression) => SelectStatement) {
        const exp = this.context.driver.compiler.compile(this, fx);
        const p1 = exp.params[0];
        if (p1) {
            p1.value = parameters;
        }
        return new EntityQuery({ ... this, selectStatement: map(this.selectStatement, exp.body)});
    }

}
