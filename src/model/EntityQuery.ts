import { BinaryExpression, CallExpression, Expression, ExpressionAs, Identifier, OrderByExpression, QuotedLiteral, SelectStatement, TableSource } from "../query/ast/Expressions.js";
import { EntitySource } from "./EntitySource.js";
import { IOrderedEntityQuery, IEntityQuery, ILambdaExpression } from "./IFilterWithParameter.js";
import { SourceExpression } from "./SourceExpression.js";

export default class EntityQuery<T = any>
    implements IOrderedEntityQuery<T>, IEntityQuery<T> {
    constructor (public readonly source: SourceExpression) {
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

        const source = this.source.copy();
        const { select } = source;
        const exp = this.source.context.driver.compiler.compileToExpression(source, parameters, fx);
        if(!select.where) {
            select.where = exp;
        } else {
            select.where = BinaryExpression.create({
                left: select.where,
                operator: "AND",
                right: exp
            });
        }
        return new EntityQuery(source);
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
        const source = this.source.copy();
        const { select } = source;
        const exp = this.source.context.driver.compiler.compileToExpression(source, parameters, fx as any);
        select.orderBy ??= [];
        select.orderBy.push(OrderByExpression.create({
            target: exp
        }));
        return new EntityQuery(source);
    }
    orderByDescending(parameters: any, fx: any): any {
        const source = this.source.copy();
        const { select } = source;
        const exp = this.source.context.driver.compiler.compileToExpression(source, parameters, fx as any);
        select.orderBy ??= [];
        select.orderBy.push(OrderByExpression.create({
            target: exp,
            descending: true
        }));
        return new EntityQuery(source);
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

}
