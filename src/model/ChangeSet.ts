import type EntityContext from "./EntityContext.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import ChangeEntry from "./ChangeEntry.js";
import { IRecord } from "../drivers/base/BaseDriver.js";
import IdentityService from "./IdentityService.js";

const entrySymbol = Symbol("entry");

const identitySymbol = Symbol("identity");

const getEntityByIdentity = Symbol("getEntityByIdentity");

export const privateUpdateEntry = Symbol("updateEntry");

export default class ChangeSet {

    public readonly entries: ChangeEntry[] = [];

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
            this.identityMap.set(jsonKey, entry.entity);
        }
    }

    public getEntry(entity, original = void 0): ChangeEntry {
        let entry = this.entryMap.get(entity);
        if (entry) {
            return entry;
        }
        const type = SchemaRegistry.model(Object.getPrototypeOf(entity).constructor);
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
        entity[entrySymbol] = entry;
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