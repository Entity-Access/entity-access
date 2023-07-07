import { BinaryExpression, CallExpression, Expression, ExpressionAs, Identifier, OrderByExpression, QuotedLiteral, SelectStatement, TableSource } from "../query/ast/Expressions.js";
import { EntitySource } from "./EntitySource.js";
import { IOrderedEntityQuery, IEntityQuery, ILambdaExpression } from "./IFilterWithParameter.js";
import { SourceExpression } from "./SourceExpression.js";

export default class EntityQuery<T = any>
    implements IOrderedEntityQuery<T>, IEntityQuery<T> {
    constructor (public readonly source: SourceExpression) {
    }

    select(p: any, fx: any): any {
        return this.map(p, fx);
    }

    map(p: any, fx: any): any {
        const source = this.source.copy();
        const { select } = source;
        const exp = this.source.context.driver.compiler.compileToExpression(source, p, fx);
    }

    withSignal(signal: AbortSignal): any {
        const source = this.source.copy();
        source.signal = signal;
        return new EntityQuery(source);
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
        const type = this.source.model?.typeClass;
        const signal = this.source.signal;
        const query = this.source.context.driver.compiler.compileExpression(this.source.select);
        const reader = await this.source.context.driver.executeReader(query, signal);
        try {
            for await (const iterator of reader.next(10, signal)) {
                if (type) {
                    Object.setPrototypeOf(iterator, type.prototype);
                    // set identity...
                    const entry = this.source.context.changeSet.getEntry(iterator, iterator);
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
        throw new Error(`No records found for ${this.source.model?.name || "Table"}`);
    }

    async first(): Promise<T> {
        for await(const iterator of this.limit(1).enumerate()) {
            return iterator;
        }
        return null;
    }
    toQuery(): { text: string; values: any[]; } {
        return this.source.context.driver.compiler.compileExpression(this.source.select);
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
        const source = this.source.copy();
        const { select } = source;
        select.limit = n;
        return new EntityQuery(source);
    }

    offset(n: number): any {
        const source = this.source.copy();
        const { select } = source;
        select.offset = n;
        return new EntityQuery(source);
    }

    async count(parameters?:any, fx?: any): Promise<number> {
        if (parameters !== void 0) {
            return this.where(parameters, fx).count();
        }

        const source = this.source.copy();
        const { select } = source;

        select.fields = [
            ExpressionAs.create({
                expression: CallExpression.create({
                    callee: Identifier.create({ value: "COUNT"}),
                    arguments: [ Identifier.create({ value: "*"})]
                }),
                alias: QuotedLiteral.create({ literal: "count" })
            })
        ];

        const query = this.source.context.driver.compiler.compileExpression(select);
        const reader = await this.source.context.driver.executeReader(query);

        try {
            for await (const iterator of reader.next()) {
                return iterator.count as number;
            }
        } finally {
            await reader.dispose();
        }

    }

    private extend(parameters: any, fx: any, map: (select: SelectStatement, exp: Expression) => SelectStatement) {

        const { select } = this.source;
        const exp = this.source.context.driver.compiler.compile(fx);
        exp.params[0].value = parameters;
        const source = this.source.copy();
        source.select = map(select, exp.body);
        return new EntityQuery(source);
    }

}
