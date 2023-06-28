import type EntityContext from "./EntityContext.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import EntityType from "../entity-query/EntityType.js";

interface IChange {
    type: EntityType;
    entity: any;
    status: "detached" | "attached" | "inserted" | "modified" | "deleted";
};

export default class ChangeSet {

    public readonly entries: IChange[] = [];

    constructor(private context: EntityContext) {

    }

    public getEntry(entity) {
        for (const iterator of this.entries) {
            if (iterator.entity === entity) {
                return iterator;
            }
        }
        const type = SchemaRegistry.model(Object.getPrototypeOf(entity).constructor);
        const entry: IChange = {
            type,
            entity,
            status: "detached"
        };
        this.entries.push(entry);
        return entry;
    }

}