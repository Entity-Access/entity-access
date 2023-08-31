import CustomEvent from "../CustomEvent.js";

export default class TimedCache<TKey = any, T = any> extends EventTarget {

    private map: Map<TKey,{ value: any, expire: number, ttl: number, dispose?: (item: any) => any }> = new Map();

    constructor(private ttl = 15000) {
        super();
        setInterval((x) => x.clear(), this.ttl, this);
    }

    delete(key: any) {
        this.dispatchEvent(new CustomEvent("deleted", { detail: key }));
        this.map.delete(key);
    }

    getOrCreate<TP>(key: TKey, p1: TP, factory: (k: TKey,p: TP) => T, ttl: number = 15000) {
        let item = this.map.get(key);
        if (!item) {
            item = { value: factory(key, p1), ttl, expire: Date.now() + ttl };
            this.dispatchEvent(new CustomEvent("created", { detail: { key, item }}));
            this.map.set(key, item);
        } else {
            item.expire = Date.now() + ttl;
        }
        return item.value as T;
    }

    getOrCreateAsync(
        key: TKey,
        factory: (k: TKey) => Promise<T>,
        ttl: number = 15000,
        dispose?: ((item: T) => any)
    ): Promise<T> {
        let item = this.map.get(key);
        if (!item) {
            item = { value: factory(key), ttl, expire: Date.now() + ttl, dispose };
            this.dispatchEvent(new CustomEvent("created", { detail: { key, item }}));
            this.map.set(key, item);
            // we need to make sure we do not cache
            // the promise if it fails
            item.value.catch(() => {
                this.map.delete(key);
            });
            if (dispose) {
                item.value.then((r) => {
                    item.dispose = () => dispose(r);
                });
            }
        } else {
            item.expire = Date.now() + ttl;
        }
        return item.value;
    }

    private clear(): void {
        const expired = [];
        const now = Date.now();
        for (const [key, value] of Array.from(this.map.entries())) {
            if(value.expire < now) {
                expired.push(key);
                // call dispose..
                this.map.delete(key);
                try {
                    const r = value.dispose?.(value.value);
                    if (r?.then) {
                        r.catch(() => void 0);
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }


}
