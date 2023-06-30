import EntityType from "../entity-query/EntityType.js";
import { Expression } from "../query/ast/Expressions.js";

export type IFilterWithParameter<P, T> = (p: P) => (x: T) => boolean;

export default class EntityQuery<T> {

    constructor(
        private model: EntityType,
        private filter: Expression) {

    }

}
