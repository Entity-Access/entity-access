import EntityAccessError from "../../common/EntityAccessError.js";
import EventSet from "../../common/EventSet.js";
import { identityMapSymbol } from "../../common/symbols/symbols.js";
import EntityContext from "../EntityContext.js";
import IdentityMap from "../identity/IdentityMap.js";
import IdentityService from "../identity/IdentityService.js";
import ChangeEntry, { privateUpdateEntry, getContext } from "./ChangeEntry.js";


export default class ChangeSet {

    // public addedEvent = new EventSet<ChangeEntry>(this);

    get [identityMapSymbol]() {
        return this.identityMap;
    }

    get [getContext]() {
        return this.context;
    }

    private readonly entries: ChangeEntry[] = [];

    private entryMap: Map<any, ChangeEntry> = new Map();

    /**
     * This will provide new entity for same key
     */
    private readonly identityMap = new IdentityMap();

    private nextId = 1;

    private pending = void 0 as ChangeEntry[];

    constructor(private context: EntityContext) {
    }

    *getChanges(max = 5): Generator<ChangeEntry, any, any> {

        this.detectChanges();

        // const pending = [] as ChangeEntry[];
        // using d = this.addedEvent.listen((ce) => pending.push(ce.detail));


        let copy = this.pending = [];

        yield * [].concat(this.entries) as any;

        while(copy.length) {
            const next = this.pending = [];
            for (const iterator of copy) {
                iterator.setupInverseProperties();
                iterator.detect();
                yield iterator;
            }
            copy = next;
        }

        this.pending = void 0;
    }

    [privateUpdateEntry](entry: ChangeEntry) {
        const jsonKey = IdentityService.getIdentity(entry.type, entry.entity);
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
            this.identityMap.set(jsonKey, entry.entity, entry.type);
        }
    }

    public getByIdentity(jsonKey) {
        const existing = this.identityMap.get(jsonKey);
        if (existing) {
            return this.entryMap.get(existing);
        }
    }

    public getEntry<T>(entity: T, original = void 0): ChangeEntry<T> {
        let entry = this.entryMap.get(entity);
        if (entry) {
            return entry.updateValues(original);
        }
        const c = Object.getPrototypeOf(entity).constructor;
        if (c === Object) {
            throw new EntityAccessError("Entity type not set");
        }
        const type = this.context.model.getEntityType(c);
        const jsonKey = IdentityService.getIdentity(type, entity);
        if (jsonKey) {
            const existing = this.identityMap.get(jsonKey);
            if (existing) {
                entity = existing;
                entry = this.entryMap.get(entity);
                if (entry) {
                    return entry.updateValues(original);
                }
            } else {
                this.identityMap.set(jsonKey, entity, type);
            }
        } else {
            (entity as any).$type = type.entityName;
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
        // this.addedEvent.dispatch(entry);
        this.pending?.push(entry);
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

    /**
     * Warning, this will remove all the tracked entries,
     * use with caution.
     */
    public clear() {
        for (const iterator of this.entries) {
            iterator.cancel();
        }
        this.entries.length = 0;
        this.identityMap.clear();
        this.entryMap.clear();
    }

}