import { IColumn } from "../../decorators/IColumn.js";
import ChangeEntry from "../changes/ChangeEntry.js";

const intersect = (s1: Set<any>, s2: Set<any>) => {
    const r = new Set();
    for(const s of s1) {
        if(s2.has(s)) {
            r.add(s);
        }
    }
    return r;
};

const generateId = (key: IColumn, value: any) => `${key.type.name}-${key.name}-${value}`;

export class EntityId {

    declare id: string;

    constructor(public key: IColumn, public value) {
        this.id = generateId(key, value);
    }

    toString() {
        return this.id;
    }

}

export default class EntityIndex {

    index = new Map<string, Set<any>>();

    add(entry: ChangeEntry) {

        const { entity, type } = entry;
        for(const key of type.keys) {
            const value = entity[key.name];
            if(value === void 0 || value === null) {
                continue;
            }
            const id = generateId(key, value);

            let list = this.index.get(id);
            if(!list) {
                list = new Set();
                this.index.set(id, list);
            }
            list.add(entity);
        }
    }

    search(keys: EntityId[]) {
        // filter object that is present for all keys
        let r: Set<any> = void 0;
        for(const { id, value } of keys) {
            if(value === void 0 || value === null) {
                return;
            }
            const all = this.index.get(id);
            if(all === void 0) {
                return;
            }
            if(!r) {
                r = all;
            } else {
                r = intersect(r,all);
            }
        }
        const se = r.keys();
        const i = se.next();
        if(i.done) {
            return;
        }
        return i.value;
    }

    id(key: IColumn, value: string) {
        return new EntityId(key, value);
    }

}