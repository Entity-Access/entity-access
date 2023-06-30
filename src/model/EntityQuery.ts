import EntityType from "../entity-query/EntityType.js";
import { Expression } from "../query/ast/Expressions.js";

export interface ITargetExpression {
    model: EntityType,
    where?: Expression,
    orderBy?: Expression[],
    include?: EntityType[]
}

export default class EntityQuery<T = any> {

    public static from<T1>(model: EntityType) {
        return new EntityQuery<T1>({ model });
    }

    constructor (public readonly target: ITargetExpression) {

    }

    where<P>(p: P, fx: (px: P) => (x: T) => boolean) {

    }

    orderBy<P>(p: P, fx: (px: P) => (x: T) => any) {

    }

}
