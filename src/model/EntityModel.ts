import type EntityContext from "../EntityContext.js";
import { IClassOf } from "../decorators/IClassOf.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import type EntityType from "../entity-query/EntityType.js";

export class EntitySource<T = any> {

    constructor(
        private readonly model: EntityType,
        private readonly context: EntityContext
    ) {

    }

    public add(item: Partial<T>) {
        const p = Object.getPrototypeOf(item).constructor;
        if (!p) {
            Object.setPrototypeOf(item, this.model.typeClass);
        }
        const entry = this.context.changeSet.getEntry(item);
        if (entry.status !== "detached") {
            throw new Error("Entity is already attached to the context");
        }
        entry.status = "inserted";
    }
}

export default class EntityModel {

    constructor(private context: EntityContext) {

    }


    public entities: Map<IClassOf<any>, EntitySource> = new Map();

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
