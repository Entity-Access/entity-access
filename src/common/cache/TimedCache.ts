/* eslint-disable no-console */
import CustomEvent from "../CustomEvent.js";
import EventSet from "../EventSet.js";

export interface ICachedItem {
    dispose?: (item: any) => any;
    ttl: number;
    expire: number;
    maxExpire: number;
    value: any;
}

const cacheSet = new Set<WeakRef<TimedCache>>();

setInterval(() => {
    for (const element of cacheSet) {
        setImmediate(() => {
            const cache = element.deref();
            if (cache === void 0) {
                cacheSet.delete(element);
                return;
            }
            cache.clear();
        });
    }
}, 15000);

const w = new FinalizationRegistry<any>((heldValue) => {
    cacheSet.delete(heldValue);
});

export default class TimedCache<TKey = any, T = any> implements Disposable {

    public deletedEvent = new EventSet<TKey>(this);

    public addedEvent = new EventSet<{ key: TKey, value: T}>(this);

    public get size() {
        return this.map.size;
    }

    private map: Map<TKey,ICachedItem> = new Map();

    private times = new Map<number, TKey>();

    private weakRef;

    constructor(private ttl = 15000, private maxTTL = ttl * 4) {
        const r = new WeakRef(this);
        cacheSet.add(r);
        this.weakRef = r;
        w.register(this, r);
    }

    [Symbol.dispose]() {
        cacheSet.delete(this.weakRef);
        w.unregister(this.weakRef);
    }

    delete(key: any) {
        this.deletedEvent.dispatch(key);
        let item = this.map.get(key);
        if (item) {
            this.map.delete(key);
            this.times.delete(item.expire);
        }if (!item) {
            return;
        }
        try {
            if (item.dispose) {
                item.dispose(item.value)?.catch?.(console.error);
            }
        } catch {
            // do nothing
        }
    }

    /**
     * Delete all the keys from the cache
     * @param dispatchEvents dispatch deleted Event
     */
    clear() {
        this.clearExpired(Number.MAX_SAFE_INTEGER);
    }

    getOrCreate<TP>(key: TKey, p1: TP, factory: (k: TKey,p: TP) => T, ttl: number = this.ttl) {
        let item = this.map.get(key);
        if (!item) {
            const now = Date.now();
            const expire = now + ttl;
                item = { value: factory(key, p1), ttl, expire, maxExpire: now + this.maxTTL };
            this.addedEvent.dispatch({ key, value: item.value });
            this.map.set(key, item);
        } else {
            this.times.delete(item.expire);
            item.expire += ttl;
        }
        this.times.set(item.expire, key);
        return item.value as T;
    }

    getOrCreateAsync(
        key: TKey,
        factory: (k: TKey) => Promise<T>,
        ttl: number = this.ttl,
        dispose?: ((item: T) => any)
    ): Promise<T> {
        let item = this.map.get(key);
        if (!item) {
            const now = Date.now();
            const expire = now + ttl;
                item = { value: factory(key), ttl, expire, maxExpire: now + this.maxTTL, dispose };
            this.addedEvent.dispatch({ key, value: item.value });
            this.map.set(key, item);
            // we need to make sure we do not cache
            // the promise if it fails
            item.value.catch(() => {
                this.delete(key);
            });
            if (dispose) {
                item.value.then((r) => {
                    item.dispose = () => dispose(r);
                });
            }
        } else {
            this.times.delete(item.expire);
            item.expire += ttl;
        }
        this.times.set(item.expire, key);
        return item.value;
    }

    private clearExpired(max = Date.now()): void {

        /**
         * deletion often leads to fragmentation.
         * So we will let this array get garbate collected
         * and we will assign new times
         *
         * The reason we are doing this to an array and not a map
         * as map keys won't change regularly but times will
         * change on every access.
         */

        const oldTimes = this.times;
        this.times = new Map();

        for(const [i, key] of oldTimes.entries()) {

            if (i > max) {
                this.times.set(i, key);
                return;
            }
            const value = this.map.get(key);
            this.map.delete(key);

            // call dispose..
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
