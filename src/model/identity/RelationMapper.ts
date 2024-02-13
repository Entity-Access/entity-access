import EventEmitter from "events";
import type ChangeEntry from "../changes/ChangeEntry.js";
import type ChangeSet from "../changes/ChangeSet.js";
import IdentityService, { identityMapSymbol } from "./IdentityService.js";
import { IColumn } from "../../decorators/IColumn.js";




export default class RelationMapper {

    // private map: Map<string, ChangeEntry[]> = new Map();

    private events: EventEmitter = new EventEmitter();

    constructor(
        private changeSet: ChangeSet,
        private identityMap = changeSet[identityMapSymbol]
    ) {

    }

    // push(id: string, waiter: ChangeEntry) {
    //     let queue = this.map.get(id);
    //     if (!queue) {
    //         queue = [];
    //         this.map.set(id, queue);
    //     }
    //     queue.push(waiter);
    // }

    fix(entry: ChangeEntry, nest = true) {

        // find all parents...
        const { type, entity } = entry;
        for (const iterator of type.relations) {
            if (iterator.isInverseRelation) {
                continue;
            }
            // const fkColumn = iterator.fkColumn.name;
            // const fkValue = entity[fkColumn];
            // if (fkValue === void 0) {
            //     continue;
            // }

            // get from identity...
            // const id = IdentityService.buildIdentity(iterator.relatedEntity, fkValue);
            // const parent = this.identityMap.get(id);
            // if (!parent) {
            //     let waiters = this.map.get(id);
            //     if (!waiters) {
            //         waiters = [];
            //         this.map.set(id, waiters);
            //     }
            //     waiters.push(entry);
            //     continue;
            // }

            const pairs = [] as { key: IColumn, value: any}[];

            for (const { fkColumn, relatedKeyColumn } of iterator.fkMap) {
                this.identityMap.build(relatedKeyColumn);
                const fkValue = entity[fkColumn.name];
                if (fkValue === void 0) {
                    continue;
                }
                pairs.push({ key: relatedKeyColumn, value: fkValue});
            }

            const parent = this.identityMap.searchByKeys(pairs, true);
            if (!parent) {
                if (nest) {
                    for (const { key, value } of pairs) {
                        this.events.once(`${key.entityType.name}-${key.name}-${value}`, (k) => {
                            this.fix(entry, false);
                        });
                    }
                }
                continue;
            }

            entity[iterator.name] = parent;

            if (iterator.relatedRelation.isCollection) {
                const coll = (parent[iterator.relatedRelation.name] ??= []) as any[];
                if(!coll.includes(entity)){
                    coll.push(entity);
                }
            } else {
                parent[iterator.relatedRelation.name] = entity;
            }
        }

        if (!nest) {
            return;
        }

        // see if anyone is waiting for us or not...
        // const identity = IdentityService.getIdentity(entry.type, entry.entity);
        // const pending = this.map.get(identity);
        // if (pending && pending.length) {
        //     for (const iterator of pending) {
        //         this.fix(iterator, false);
        //     }
        // }

        for (const iterator of this.identityMap.indexedColumns) {
            if (iterator.entityType !== entry.type) {
                continue;
            }
            const value = entry.entity[iterator.name];
            if (value === void 0 || value === null) {
                continue;
            }
            const key = `${iterator.entityType.name}-${iterator.name}-${value}`;
            this.events.emit(key, key);
        }
    }
}