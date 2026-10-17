/* eslint-disable no-console */
import EALogger from "../EALogger.js";
import EventSet from "../EventSet.js";

export interface ICachedItem {
    dispose?: (item: any) => any;
    ttl: number;
    expire: number;
    maxExpire: number;
    value: any;
    touch();
}

const cacheSet = new Set<WeakRef<TimedCache>>();

setInterval(() => {
    const now = Date.now();
    for (const element of cacheSet) {
        setImmediate(() => {
            const cache = element.deref();
            if (cache === void 0) {
                cacheSet.delete(element);
                return;
            }
            // @ts-expect-error private
            cache.clearExpired(now);
        });
    }
}, 15000);

const w = new FinalizationRegistry<any>((heldValue) => {
    cacheSet.delete(heldValue);
});

export class CachedItem {

    expire: number;
    maxExpire: number;
    value: any;

    constructor(
        public readonly ttl,
        max,
        public dispose?: (item: any) => any
    ) {
        // max expire can be set only once
        this.maxExpire = Date.now() + max;
    }

    touch(updateMaxExpire = false) {
        const now = Date.now();
        this.expire = now + this.ttl;
        if(updateMaxExpire) {
            this.maxExpire += this.ttl;
        }
    }
}

export default class TimedCache<TKey = any, T = any> implements Disposable {

    public deletedEvent = new EventSet<TKey>(this);

    public addedEvent = new EventSet<{ key: TKey, value: T}>(this);

    public get size() {
        return this.map.size;
    }

    private map: Map<TKey,CachedItem> = new Map();

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
        const item = this.map.get(key);
        if (!item) {
            return;
        }
        this.map.delete(key);
        this.deletedEvent.dispatch(key);
        try {
            if (item.dispose) {
                item.dispose(item.value)?.catch?.(EALogger.error);
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

    getOrCreate<TP>(key: TKey, p1: TP, factory: (k: TKey,p: TP, item: CachedItem) => T, ttl: number = this.ttl) {
        let item = this.map.get(key);
        if (!item) {
            item = new CachedItem(ttl, this.maxTTL);
            item.touch();
            item.value = factory(key, p1, item);
            this.addedEvent.dispatch({ key, value: item.value });
            this.map.set(key, item);
        } else {
            item.touch();
        }
        return item.value as T;
    }

    async getOrCreateAsync(
        key: TKey,
        factory: (k: TKey, item: CachedItem) => Promise<T>,
        ttl: number = this.ttl,
        dispose?: ((item: T) => any)
    ): Promise<T> {
        let item = this.map.get(key);
        if (!item) {
            item = new CachedItem(ttl, this.maxTTL, dispose);
            item.value = factory(key, item);
            item.touch();
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
            item.touch();
        }
        return await item.value;
    }

    private deleteItem = ([key, item]) => {
        this.map.delete(key);
        this.deletedEvent.dispatch(key);
        try {
            if (item.dispose) {
                item.dispose(item.value)?.catch?.(EALogger.error);
            }
        } catch {
            // do nothing
        }
    };

    private clearExpired(max = Date.now()): void {

        for(const entry of this.map.entries()) {
            const value = entry[1];
            if (value.expire > max && value.maxExpire > max) {
                continue;
            }
            setImmediate(this.deleteItem, entry);
        }
    }

}
