import { entityTypeSymbol } from "../../common/symbols/symbols.js";
import { IColumn } from "../../decorators/IColumn.js";
import type EntityType from "../../entity-query/EntityType.js";

/**
 * Locally cache uniquely identifiable entities
 */
export default class IdentityMap {

    public get indexedColumns() {
        return this.keys.keys();
    }

    private map = new Map<string, any>();

    private keys = new Map<IColumn, Map<any, any[]>>();

    public delete(jsonKey) {
        const item = this.get(jsonKey);
        this.map.delete(jsonKey);
        if (item) {
            const type = item[entityTypeSymbol] as EntityType;
            for (const column of type.columns) {
                const values = this.keys.get(column);
                if (!values) {
                    continue;
                }
                const value = item[column.name];
                if (value === void 0 || value === null) {
                    continue;
                }
                const entries = values.get(value);
                if (!entries) {
                    continue;
                }
                const index = entries.findIndex(item);
                entries.splice(index, 1);
            }
        }
    }

    public get(jsonKeys) {
        return this.map.get(jsonKeys);
    }

    public set(jsonKey, entity, type: EntityType) {
        entity[entityTypeSymbol] = type;
        this.map.set(jsonKey, entity);
        for (const key of this.keys.keys()) {
            if(type.getField(key.name) !== key) {
                continue;
            }
            const keyEntry = this.getKeyEntry(key, true);
            const value = entity[key.name];
            if (value === void 0 || value === null) {
                continue;
            }
            let values = keyEntry.get(value);
            if (!values) {
                values = [];
                keyEntry.set(value, values);
            }
            if (values.includes(entity)) {
                continue;
            }
            values.push(entity);
        }
    }

    public clear() {
        this.map.clear();
        this.keys.clear();
    }

    public build(key: IColumn) {
        return this.getKeyEntry(key, true);
    }

    searchByKeys(pairs: { key: IColumn, value}[], create = true) {
        let results: any[];
        for (const { key, value } of pairs) {
            const items = this.getAll(key, value, create);
            if (!items?.length) {
                return;
            }
            if (!results) {
                results = [].concat(items);
                continue;
            }
            const old = results;
            results = [];
            for (const item of items) {
                if (old.includes(item)) {
                    results.push(item);
                }
            }
        }
        return results[0];
    }

    private getAll(key: IColumn, value: any, create = true) {
        const keyEntry = this.getKeyEntry(key, create);
        return keyEntry.get(value);
    }

    private getKeyEntry(key: IColumn, create = false) {
        let keyEntry = this.keys.get(key);
        if (keyEntry) {
            return keyEntry;
        }
        if (!create) {
            return;
        }
        keyEntry = new Map<any, any[]>();
        this.keys.set(key, keyEntry);
        for (const entry of this.map.values()) {
            const type = entry[entityTypeSymbol] as EntityType;
            if(type.getField(key.name) !== key) {
                continue;
            }
            const value = entry[key.name];
            if (value === void 0 || value === null) {
                continue;
            }
            let values = keyEntry.get(value);
            if (!values) {
                values = [];
                keyEntry.set(value, values);
            }
            values.push(entry);
        }
        return keyEntry;
    }

}