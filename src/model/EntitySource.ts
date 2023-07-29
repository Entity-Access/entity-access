import type EntityContext from "./EntityContext.js";
import type EntityType from "../entity-query/EntityType.js";
import type { IEntityQuery, IFilterExpression } from "./IFilterWithParameter.js";
import { Expression } from "../query/ast/Expressions.js";
import EntityQuery from "./EntityQuery.js";
import { contextSymbol, modelSymbol } from "../common/symbols/symbols.js";

export class EntitySource<T = any> {

    get [modelSymbol]() {
        return this.model;
    }

    get[contextSymbol]() {
        return this.context;
    }

    private filter: Expression;

    constructor(
        private readonly model: EntityType,
        private readonly context: EntityContext
    ) {

    }

    public add(item: Partial<T>): T {
        const p = Object.getPrototypeOf(item).constructor;
        if (!p || p === Object) {
            Object.setPrototypeOf(item, this.model.typeClass.prototype);
        }
        const entry = this.context.changeSet.getEntry(item);
        if (entry.status !== "detached" && entry.status !== "unchanged") {
            throw new Error("Entity is already attached to the context");
        }
        entry.status = "inserted";
        return entry.entity;
    }

    /**
     * Entity can only be deleted if all primary keys are present
     * @param item entity to delete
     */
    public delete(item: Partial<T>) {
        const p = Object.getPrototypeOf(item).constructor;
        if (!p || p === Object) {
            Object.setPrototypeOf(item, this.model.typeClass.prototype);
        }
        const entry = this.context.changeSet.getEntry(item);
        /** There is no need to check this, we will simply delete the entry */
        // if (entry.status === "modified" || entry.status === "deleted") {
        //     entry.status = "deleted";
        //     return entry.entity;
        // }
        // if (entry.status !== "detached" && entry.status !== "unchanged") {
        //     throw new Error("Entity is already attached to the context");
        // }
        entry.status = "deleted";
        return entry.entity;
    }

    public all(): IEntityQuery<T> {
        return this.asQuery();
    }

    public filtered(mode: "read" | "modify" = "read"): IEntityQuery<T> {
        const query = this.asQuery();
        const events = this.context.eventsFor(this.model.typeClass, true);
        return mode === "modify" ? events.modify(query) : events.filter(query);
    }

    public where<P>(...[parameter, fx]: IFilterExpression<P, T>) {
        return this.asQuery().where(parameter, fx);
    }

    public asQuery() {
        const { model, context } = this;
        const selectStatement = this.model.selectAllFields();
        selectStatement.model = model;
        return new EntityQuery<T>({
            context,
            type: model,
            selectStatement
        }) as any as IEntityQuery<T>;

    }

    public toQuery() {
        const filter = this.filter;
        if(!filter) {
            return "";
        }
        return this.context.driver.compiler.compileExpression( this.asQuery() as any, filter);
    }
}
