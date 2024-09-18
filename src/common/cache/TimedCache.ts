import CustomEvent from "../CustomEvent.js";
import EventSet from "../EventSet.js";

export default class TimedCache<TKey = any, T = any> {

    public deletedEvent = new EventSet<TKey>(this);

    public addedEvent = new EventSet<{ key: TKey, value: T}>(this);

    private map: Map<TKey,{ value: any, expire: number, ttl: number, dispose?: (item: any) => any }> = new Map();

    constructor(private ttl = 15000) {
        setInterval((x) => x.clear(), this.ttl, this);
    }

    delete(key: any) {
        this.deletedEvent.dispatch(key);
        this.map.delete(key);
    }

    /**
     * Delete all the keys from the cache
     * @param dispatchEvents dispatch deleted Event
     */
    deleteAll(dispatchEvents = true) {
        if (dispatchEvents) {
            for (const key of this.map.keys()) {
                this.deletedEvent.dispatch(key);
            }
        }
        this.map.clear();
    }

    getOrCreate<TP>(key: TKey, p1: TP, factory: (k: TKey,p: TP) => T, ttl: number = 15000) {
        let item = this.map.get(key);
        if (!item) {
            item = { value: factory(key, p1), ttl, expire: Date.now() + ttl };
            this.addedEvent.dispatch({ key, value: item.value });
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
            this.addedEvent.dispatch({ key, value: item.value });
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
                this.deletedEvent.dispatch(key);
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
