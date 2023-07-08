import EntityType from "../entity-query/EntityType.js";
import { CallExpression, Expression, ExpressionAs, Identifier, OrderByExpression, QuotedLiteral, SelectStatement } from "../query/ast/Expressions.js";
import EntityContext from "./EntityContext.js";
import { IOrderedEntityQuery, IEntityQuery } from "./IFilterWithParameter.js";

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

    async toArray(): Promise<T[]> {
        const results: T[] = [];
        for await (const iterator of this.enumerate()) {
            results.push(iterator);
        }
        return results;
    }

    async *enumerate(): AsyncGenerator<T, any, unknown> {
        const type = this.type;
        const signal = this.signal;
        const query = this.context.driver.compiler.compileExpression(this, this.selectStatement);
        const reader = await this.context.driver.executeReader(query, signal);
        try {
            for await (const iterator of reader.next(10, signal)) {
                if (type) {
                    Object.setPrototypeOf(iterator, type.typeClass.prototype);
                    // set identity...
                    const entry = this.context.changeSet.getEntry(iterator, iterator);
                    yield entry.entity;
                    continue;
                }
                yield iterator as T;
            }
        } finally {
            await reader.dispose();
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
                alias: QuotedLiteral.create({ literal: "count" })
            })
        ] };

        const nq = new EntityQuery({ ... this, selectStatement: select });

        const query = this.context.driver.compiler.compileExpression(nq, select);
        const reader = await this.context.driver.executeReader(query);

        try {
            for await (const iterator of reader.next()) {
                return iterator.count as number;
            }
        } finally {
            await reader.dispose();
        }

    }

    private extend(parameters: any, fx: any, map: (select: SelectStatement, exp: Expression) => SelectStatement) {
        const exp = this.context.driver.compiler.compile(this, fx);
        exp.params[0].value = parameters;
        return new EntityQuery({ ... this, selectStatement: map(this.selectStatement, exp.body)});
    }

}
