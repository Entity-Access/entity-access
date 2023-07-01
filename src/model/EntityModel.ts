import type EntityContext from "./EntityContext.js";
import { IClassOf } from "../decorators/IClassOf.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import type EntityType from "../entity-query/EntityType.js";
import EntityQuery from "./EntityQuery.js";

export class EntitySource<T = any> {

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

    public where<P>(p: P, fx: (px: P) => (t: T) => boolean) {
        return EntityQuery.from<T>(this.model).where(p, fx);
    }
}

export default class EntityModel {

    public entities: Map<IClassOf<any>, EntitySource> = new Map();

    constructor(private context: EntityContext) {
    }

    register<T>(type: IClassOf<T>) {
        let source = this.entities.get(type);
        if (!source) {
            const model = SchemaRegistry.model(type);
            source = new EntitySource(model, this.context);
            this.entities.set(type, source);
        }
        return source as EntitySource<T>;
    }

}