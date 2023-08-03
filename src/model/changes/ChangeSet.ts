import EntityAccessError from "../../common/EntityAccessError.js";
import SchemaRegistry from "../../decorators/SchemaRegistry.js";
import EntityContext from "../EntityContext.js";
import IdentityService, { identityMapSymbol } from "../identity/IdentityService.js";
import ChangeEntry from "./ChangeEntry.js";

export const privateUpdateEntry = Symbol("updateEntry");

export default class ChangeSet {

    public readonly entries: ChangeEntry[] = [];

    get [identityMapSymbol]() {
        return this.identityMap;
    }

    private entryMap: Map<any, ChangeEntry> = new Map();

    /**
     * This will provide new entity for same key
     */
    private identityMap: Map<string,ChangeEntry> = new Map();

    private nextId = 1;

    constructor(private context: EntityContext) {

    }

    [privateUpdateEntry](entry: ChangeEntry) {
        const jsonKey = IdentityService.getIdentity(entry.entity);
        if (jsonKey) {
            if (entry.status === "deleted") {
                this.identityMap.delete(jsonKey);
                const index = this.entries.indexOf(entry);
                if (index !== -1) {
                    this.entries.splice(index, 1);
                }
                this.entryMap.delete(entry.entity);
                return;
            }
            this.identityMap.set(jsonKey, entry.entity);
        }
    }

    public getEntry(entity, original = void 0): ChangeEntry {
        let entry = this.entryMap.get(entity);
        if (entry) {
            return entry;
        }
        const c = Object.getPrototypeOf(entity).constructor;
        if (c === Object) {
            throw new EntityAccessError("Entity type not set");
        }
        const type = this.context.model.getEntityType(c);
        const jsonKey = IdentityService.getIdentity(entity);
        if (jsonKey) {
            const existing = this.identityMap.get(jsonKey);
            if (existing) {
                entity = existing;
                entry = this.entryMap.get(entity);
                if (entry) {
                    return entry;
                }
            } else {
                this.identityMap.set(jsonKey, entity);
            }
        }
        entry = new ChangeEntry({
            type,
            entity,
            order: 0,
            original: original ? { ... original } : void 0,
            status: "unchanged"
        }, this);
        this.entries.push(entry);
        this.entryMap.set(entity, entry);
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