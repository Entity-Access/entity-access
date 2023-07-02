import { BinaryExpression, Expression, SelectStatement, TableSource } from "../query/ast/Expressions.js";
import { EntitySource } from "./EntitySource.js";
import { IOrderedEntityQuery, IEntityQuery, ILambdaExpression } from "./IFilterWithParameter.js";
import { SourceExpression } from "./SourceExpression.js";

export default class EntityQuery<T = any>
    implements IOrderedEntityQuery<T>, IEntityQuery<T> {
    constructor (public readonly source: SourceExpression) {
    }
    thenBy<P, TR>(parameters: P, fx: ILambdaExpression<P, T, TR>) {
        throw new Error("Method not implemented.");
    }
    thenByDescending<P, TR>(parameters: P, fx: ILambdaExpression<P, T, TR>) {
        throw new Error("Method not implemented.");
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
    enumerate(): AsyncGenerator<T, any, unknown> {
        throw new Error("Method not implemented.");
    }
    firstOrFail(): Promise<T> {
        throw new Error("Method not implemented.");
    }
    first(): Promise<T> {
        throw new Error("Method not implemented.");
    }
    toQuery(): { text: string; values: any[]; } {
        return this.source.context.driver.compiler.compileExpression(this.source.select);
    }
    orderBy<P, TR>(parameters: P, fx: ILambdaExpression<P, T, TR>) {
        throw new Error("Method not implemented.");
    }
    orderByDescending<P, TR>(parameters: P, fx: ILambdaExpression<P, T, TR>) {
        throw new Error("Method not implemented.");
    }

}
