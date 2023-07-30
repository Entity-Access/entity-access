import type ChangeEntry from "../changes/ChangeEntry.js";
import type ChangeSet from "../changes/ChangeSet.js";
import IdentityService, { identityMapSymbol } from "./IdentityService.js";

export default class RelationMapper {

    private map: Map<string, ChangeEntry[]> = new Map();

    constructor(
        private changeSet: ChangeSet,
        private identityMap: Map<string, ChangeEntry> = changeSet[identityMapSymbol]
    ) {

    }

    push(id: string, waiter: ChangeEntry) {
        let queue = this.map.get(id);
        if (!queue) {
            queue = [];
            this.map.set(id, queue);
        }
        queue.push(waiter);
    }

    fix(entry: ChangeEntry, nest = true) {

        // find all parents...
        const { type, entity } = entry;
        for (const iterator of type.relations) {
            if (iterator.isInverseRelation) {
                continue;
            }
            const fkColumn = iterator.fkColumn.name;
            const fkValue = entity[fkColumn];
            if (fkValue === void 0) {
                continue;
            }
            // get from identity...
            const id = IdentityService.buildIdentity(iterator.relatedEntity, fkValue);
            const parent = this.identityMap.get(id);
            if (!parent) {
                let waiters = this.map.get(id);
                if (!waiters) {
                    waiters = [];
                    this.map.set(id, waiters);
                }
                waiters.push(entry);
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
        const identity = IdentityService.getIdentity(entry.entity);
        const pending = this.map.get(identity);
        if (pending && pending.length) {
            for (const iterator of pending) {
                this.fix(iterator, false);
            }
        }
    }
}