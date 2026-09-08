import { entriesSymbol } from "../../common/symbols/symbols.js";
import ChangeEntry from "../changes/ChangeEntry.js";
import ChangeSet from "../changes/ChangeSet.js";
import EntityIndex, { EntityId } from "./EntityIndex.js";
import { IColumn, IEntityRelation } from "../../decorators/IColumn.js";


// class RelationMerge {

//     pending: ((e: any) => void)[] = [];

//     parent: any;

//     merge(parent) {
//         this.parent = parent;
//         for(const p of this.pending) {
//             p(parent);
//         }
//         this.pending = void 0;
//     }

//     push(fx: (e: any) => void) {
//         if(this.parent) {
//             fx(this.parent);
//             return;
//         }
//         this.pending.push(fx);
//     }

// }

export default class RelationSession implements Disposable {

    index = new EntityIndex();
    pending = new Set<ChangeEntry>();
    merged = new Set<ChangeEntry>();

    constructor(changeSet: ChangeSet) {
        for(const entry of changeSet[entriesSymbol]) {
            this.fix(entry);
        }
    }

    fix(entry: ChangeEntry) {

        this.index.add(entry);

        this.resolveRelations(entry);

        for(const pending of this.pending.values()) {
            this.fix(pending);
        }
    }

    resolveRelations(entry: ChangeEntry) {
        let remove = true;
        const { entity, type } = entry;
        exit: for (const iterator of type.relations) {
            if (iterator.isInverseRelation) {
                continue;
            }

            const keys = [] as IColumn[];

            for (const { fkColumn, relatedKeyColumn } of iterator.fkMap) {
                const fkValue = entity[fkColumn.name];
                if (fkValue === void 0 || fkValue === null) {
                    continue exit;
                }
                keys.push(relatedKeyColumn);
            }

            remove &&= this.resolve(entry, iterator, keys);
        }
        if(remove) {
            // all are resolved...
            this.pending.delete(entry);
        }
    }

    resolve(entry: ChangeEntry, rel: IEntityRelation, keys: IColumn[]) {
        const { entity } = entry;
        if(entity[rel.name]) {
            return true;
        }
        const ids = [] as EntityId[];
        for(const key of keys) {
            const value = entity[key.name];
            if(value === void 0 || key === null) {
                return;
            }
            ids.push(new EntityId(key, value));
        }
        const parent = this.index.search(ids);
        if(!parent) {
            this.pending.add(entry);
            return;
        }
        entity[rel.name] = parent;
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
        
    }

}