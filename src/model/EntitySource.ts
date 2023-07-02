import type EntityContext from "./EntityContext.js";
import type EntityType from "../entity-query/EntityType.js";
import type { IFilterExpression } from "./IFilterWithParameter.js";
import { Expression, PlaceholderExpression } from "../query/ast/Expressions.js";

export class EntitySource<T = any> {

    public readonly filters: {
        read?: () => IFilterExpression;
        modify?: () => IFilterExpression;
        delete?: () => IFilterExpression;
        include?: () => IFilterExpression;
    } = {};

    private filter: Expression;

    constructor(
        private readonly model: EntityType,
        private readonly context: EntityContext
    ) {
    }

    public add(item: Partial<T>) {
        const p = Object.getPrototypeOf(item).constructor;
        if (!p || p === Object) {
            Object.setPrototypeOf(item, this.model.typeClass.prototype);
        }
        const entry = this.context.changeSet.getEntry(item);
        if (entry.status !== "detached" && entry.status !== "unchanged") {
            throw new Error("Entity is already attached to the context");
        }
        entry.status = "inserted";
        return item as T;
    }

    public where<P>(...[parameter, fx]: IFilterExpression<P, T>) {
        const compiled = this.context.driver.compiler.compile(this, fx);
        const expression = (p) => compiled.map((x) => typeof x === "function" ? x(p) : x);
        PlaceholderExpression.create({ expression: () => ({ parameter, expression })});
    }
}
