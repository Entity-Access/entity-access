export default class CIMap<V> implements Map<string, V> {

    [Symbol.toStringTag] = "CIMap";

    get size() {
        return this.map.size;
    }

    private map = new Map<string,V>();


    clear() {
        this.map.clear();
    }
    delete(key: string): boolean {
        key = key?.toLowerCase();
        return this.map.delete(key);
    }
    forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg?: any): void {
        return this.map.forEach(callbackfn);
    }
    get(key: string): V {
        key = key?.toLowerCase();
        return this.map.get(key);
    }
    has(key: string): boolean {
        key = key?.toLowerCase();
        return this.map.has(key);
    }
    set(key: string, value: V): this {
        key = key?.toLowerCase();
        this.map.set(key, value);
        return this;
    }

    entries() {
        return this.map.entries();
    }
    keys() {
        return this.map.keys();
    }
    values() {
        return this.map.values();
    }
    [Symbol.iterator]() {
        return this.map[Symbol.iterator]();
    }


}