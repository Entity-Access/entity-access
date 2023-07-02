import type EntityContext from "./EntityContext.js";
import type EntityType from "../entity-query/EntityType.js";
import type { IEntityQuery, IFilterExpression } from "./IFilterWithParameter.js";
import { BinaryExpression, Expression, PlaceholderExpression } from "../query/ast/Expressions.js";

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
        const exp = this.context.driver.compiler.compileToExpression(this, parameter, fx);
        if (this.filter) {
            this.filter = BinaryExpression.create({ left: this.filter, operator: "AND", right: exp });
        } else {
            this.filter = exp;
        }
        return this as any as IEntityQuery<T>;
    }

    public toQuery() {
        const filter = this.filter;
        if(!filter) {
            return "";
        }
        return this.context.driver.compiler.compileExpression(filter);
    }
}
