import type EntityContext from "./EntityContext.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import ChangeEntry from "./ChangeEntry.js";

const entrySymbol = Symbol("entry");

export default class ChangeSet {

    public readonly entries: ChangeEntry[] = [];

    constructor(private context: EntityContext) {

    }

    public getEntry(entity, original = void 0) {

        let entry = entity[entrySymbol]  as ChangeEntry;
        if (entry) {
            return entry;
        }

        const type = SchemaRegistry.model(Object.getPrototypeOf(entity).constructor);
        entry = new ChangeEntry({
            type,
            entity,
            order: 0,
            original,
            status: "unchanged"
        }, this);
        entity[entrySymbol] = entry;
        this.entries.push(entry);
        return entry;
    }

    /**
     * Detect changes will detect and sort the entries as they should be inserted.
     */
    public detectChanges() {

        for (const iterator of this.entries) {
            iterator.setupInverseProperties();
        }

        for (const iterator of this.entries) {
            iterator.detect();
        }

        this.entries.sort((a, b) => a.order - b.order);

    }

}