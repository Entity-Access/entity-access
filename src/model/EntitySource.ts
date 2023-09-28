import type EntityContext from "./EntityContext.js";
import type EntityType from "../entity-query/EntityType.js";
import type { IEntityQuery, IFilterExpression } from "./IFilterWithParameter.js";
import EntityQuery from "./EntityQuery.js";
import { contextSymbol, modelSymbol } from "../common/symbols/symbols.js";
import { Expression } from "../query/ast/Expressions.js";
import { DirectSaveType } from "../drivers/base/BaseDriver.js";

export class EntitySource<T = any> {

    public statements = {

    };

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

    public async saveDirect(item: Partial<T>, mode: DirectSaveType, keys?: Partial<T>) {
        const { driver } = this.context;

        if (mode === "insert-select" || mode === "upsert") {
            // check if it exits..
            let checkKeys = keys;
            if (!checkKeys) {
                checkKeys = {};
                for (const iterator of this.model.keys) {
                    checkKeys[iterator.name] = item[iterator.name];
                }
            }
            const exists = driver.createSelectWithKeysExpression(this.model, checkKeys);
            const q = driver.compiler.compileExpression(null, exists);
            const er = await this.context.connection.executeQuery(q);
            if (er.rows?.[0]) {
                const fr = er.rows[0];
                for (const key in fr) {
                    if (Object.prototype.hasOwnProperty.call(fr, key)) {
                        const element = fr[key];
                        const name = this.model.getColumn(key).name;
                        item[name] = element;
                    }
                }

                if (mode !== "upsert") {
                    return item;
                }
                mode = "update";
            }
        }

        const expression = driver.createUpsertExpression(this.model, item, mode, keys);
        if (!expression) {
            return item;
        }
        const { text, values } = driver.compiler.compileExpression(null, expression);
        const r = await this.context.connection.executeQuery({ text, values });
        if(r.rows?.length) {
            const first = r.rows[0];
            for (const key in first) {
                if (Object.prototype.hasOwnProperty.call(first, key)) {
                    const element = first[key];
                    const name = this.model.getColumn(key).name;
                    item[name] = element;
                }
            }
        }
        return item;
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
        return entry.entity as T;
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
