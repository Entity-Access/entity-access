import { entriesSymbol } from "../../common/symbols/symbols.js";
import ChangeEntry from "../changes/ChangeEntry.js";
import ChangeSet from "../changes/ChangeSet.js";
import EntityIndex, { EntityId } from "./EntityIndex.js";
import { IEntityRelation } from "../../decorators/IColumn.js";

export default class RelationSession implements Disposable {

    index = new EntityIndex();
    pending = new Map<string, Set<ChangeEntry>>();
    merged = new Set<ChangeEntry>();

    constructor(changeSet: ChangeSet) {
        for(const entry of changeSet[entriesSymbol]) {
            this.fix(entry);
        }
    }

    fix(entry: ChangeEntry) {

        this.index.add(entry);

        this.resolveRelations(entry);

        for(const key of entry.type.keys) {
            const id = new EntityId(key, entry.entity[key.name]);
            const all = this.pending.get(id.id);
            if(all) {
                for(const e of all.values()) {
                    this.resolveRelations(e);
                }
            }
        }
    }

    resolveRelations(entry: ChangeEntry) {
        const { entity, type } = entry;

        exit: for (const iterator of type.relations) {
            if (iterator.isInverseRelation) {
                continue;
            }

            const ids = [] as EntityId[];

            for (const { fkColumn, relatedKeyColumn } of iterator.fkMap) {
                const fkValue = entity[fkColumn.name];
                if (fkValue === void 0 || fkValue === null) {
                    continue exit;
                }
                ids.push(new EntityId(relatedKeyColumn, fkValue));
            }

            this.resolve(entry, iterator, ids);
        }
    }

    resolve(entry: ChangeEntry, rel: IEntityRelation, ids: EntityId[]) {
        const { entity } = entry;
        let parent = entity[rel.name];
        if(!parent) {
            parent = this.index.search(ids);
            if(!parent && this.pending) {
                for(const id of ids) {
                    let list = this.pending.get(id.id);
                    if(!list) {
                        list = new Set();
                        this.pending.set(id.id, list);
                    }
                    list.add(entry);
                }
                return;
            }
            entity[rel.name] = parent;
        }
        // remove from pending if found...
        if(this.pending) {
            for(const id1 of ids) {
                const list = this.pending.get(id1.id);
                if(list) {
                    list.delete(entry);
                    if(list.size === 0) {
                        this.pending.delete(id1.id);
                    }
                }
            }
        }
        if (rel.relatedRelation.isCollection) {
            const coll = (parent[rel.relatedRelation.name] ??= []) as any[];
            if(!coll.includes(entity)){
                coll.push(entity);
            }
        } else {
            parent[rel.relatedRelation.name] = entity;
        }
        return true;
    }

    [Symbol.dispose](): void {
        // const all = this.pending.values();
        // this.pending = void 0;
        // for(const p of all) {
        //     for(const e of p) {
        //         this.resolveRelations(e);
        //     }
        // }
    }

}