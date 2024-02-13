import type { IColumn } from "../../decorators/IColumn.js";
import type ChangeEntry from "../changes/ChangeEntry.js";

export default class SearchIndex {

    private keys = new Map<string, Map<any, any[]>>();

    constructor(private entries: ChangeEntry[]) {

    }

    getByKeys(pairs: { key, value}[], create = true) {
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
        return results;
    }

    getAll(key: string, value: any, create = true) {
        const keyEntry = this.getKeyEntry(key, create);
        return keyEntry.get(value);
    }

    delete(entry) {
        for (const [key,values] of this.keys) {
            const value = entry[key];
            if (value === void 0 || value === null) {
                continue;
            }
            const entries = values.get(value);
            if (!entries) {
                continue;
            }
            const index = entries.findIndex(entry);
            entries.splice(index, 1);
        }
    }

    get(keys: IColumn[], entry) {
        let results: any[];
        for (const { name } of keys) {
            const items = this.getAll(name, entry[name]);
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

    update(keys: IColumn[], entry) {
        for (const key of keys) {
            const keyEntry = this.getKeyEntry(key.name, true);
            const value = entry[key.name];
            if (value === void 0 || value === null) {
                continue;
            }
            let values = keyEntry.get(value);
            if (!values) {
                values = [];
                keyEntry.set(value, values);
            }
            if (values.includes(entry)) {
                continue;
            }
            values.push(entry);
        }
    }

    private getKeyEntry(key: string, create = false) {
        let keyEntry = this.keys.get(key);
        if (keyEntry) {
            return keyEntry;
        }
        if (!create) {
            return;
        }
        keyEntry = new Map<any, any[]>();
        this.keys.set(key, keyEntry);
        for (const entry of this.entries) {
            const value = entry[key];
            if (value === void 0 || value === null) {
                continue;
            }
            let values = keyEntry.get(value);
            if (!values) {
                values = [];
                keyEntry.set(value, values);
            }
            values.push(value);
        }
        return keyEntry;
    }

}