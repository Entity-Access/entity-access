import Logger from "../common/Logger.js";
import { DisposableScope } from "../common/usingAsync.js";
import { ServiceProvider } from "../di/di.js";
import { IDbReader } from "../drivers/base/BaseDriver.js";
import EntityType from "../entity-query/EntityType.js";
import { CallExpression, Expression, ExpressionAs, Identifier, OrderByExpression, SelectStatement } from "../query/ast/Expressions.js";
import { ITextQuery } from "../query/ast/IStringTransformer.js";
import { QueryExpander } from "../query/expander/QueryExpander.js";
import EntityContext from "./EntityContext.js";
import { IOrderedEntityQuery, IEntityQuery } from "./IFilterWithParameter.js";
import { filteredSymbol } from "./events/FilteredExpression.js";
import RelationMapper from "./identity/RelationMapper.js";

export default class EntityQuery<T = any>
    implements IOrderedEntityQuery<T>, IEntityQuery<T> {

    public context: EntityContext;
    public type: EntityType;
    public selectStatement: SelectStatement;
    public signal?: AbortSignal;
    constructor (p: Partial<EntityQuery<any>>
    ) {
        // lets clone select...
        Object.setPrototypeOf(p, EntityQuery.prototype);
        return p as EntityQuery;
    }

    select(p: any, fx: any): any {
        return this.map(p, fx);
    }

    map(p: any, fx: any): any {
        // const source = this.source.copy();
        // const { select } = source;
        // const exp = this.source.context.driver.compiler.compileToExpression(source, p, fx);
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
        const selectStatement = QueryExpander.expand(this.context, { ... this.selectStatement }, p, !this.selectStatement[filteredSymbol]);
        return new EntityQuery({
            ... this,
            selectStatement
        });
    }

    async toArray(): Promise<T[]> {
        const results: T[] = [];
        for await (const iterator of this.enumerate()) {
            results.push(iterator);
        }
        return results;
    }

    async *enumerate(): AsyncGenerator<T, any, unknown> {
        const scope = new DisposableScope();
        const session = this.context.logger?.newSession() ?? Logger.nullLogger;
        let query: { text: string, values: any[]};
        try {
            scope.register(session);
            const type = this.type;
            const signal = this.signal;

            const relationMapper = new RelationMapper(this.context.changeSet);

            const include = this.selectStatement.include;
            if (include?.length > 0) {
                // since we will be streaming results...
                // it is important that we load all the
                // included entities first...
                const loaders = include.map((x) => this.load(relationMapper, session, x, signal));
                await Promise.all(loaders);
            }

            signal?.throwIfAborted();

            query = this.context.driver.compiler.compileExpression(this, this.selectStatement);
            const reader = await this.context.connection.executeReader(query, signal);
            scope.register(reader);
            for await (const iterator of reader.next(10, signal)) {
                if (type) {
                    const item = type?.map(iterator) ?? iterator;
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
        } finally {
            await scope.dispose();
        }
    }

    async load(relationMapper: RelationMapper, session: Logger, select: SelectStatement, signal: AbortSignal) {
        let query: { text, values };
        let reader: IDbReader;
        try {
            query = this.context.driver.compiler.compileExpression(this, select);
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

    limit(n: number): any {
        return new EntityQuery({ ... this, selectStatement: { ... this.selectStatement, limit: n} });
    }

    offset(n: number): any {
        return new EntityQuery({ ... this, selectStatement: { ... this.selectStatement, offset: n} });
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

        const scope = new DisposableScope();
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
        } finally {
            await scope.dispose();
        }

    }

    private extend(parameters: any, fx: any, map: (select: SelectStatement, exp: Expression) => SelectStatement) {
        const exp = this.context.driver.compiler.compile(this, fx);
        exp.params[0].value = parameters;
        return new EntityQuery({ ... this, selectStatement: map(this.selectStatement, exp.body)});
    }

}
