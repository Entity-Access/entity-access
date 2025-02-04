/* eslint-disable no-console */
import CustomEvent from "../CustomEvent.js";
import EventSet from "../EventSet.js";

const w = new FinalizationRegistry<any>((heldValue) => {
    clearInterval(heldValue);
});

export interface ICachedItem {
    dispose?: (item: any) => any;
    ttl: number;
    expire: number;
    value: any;
}

export default class TimedCache<TKey = any, T = any> implements Disposable {

    public deletedEvent = new EventSet<TKey>(this);

    public addedEvent = new EventSet<{ key: TKey, value: T}>(this);

    private map: Map<TKey,ICachedItem> = new Map();

    private g1: Map<TKey, ICachedItem>;
    private g2: Map<TKey, ICachedItem>;

    private cid: NodeJS.Timer;

    private tid: any;

    constructor(private ttl = 15000) {
        const cid = setInterval((x) => x.clearExpired(), this.ttl, this);
        this.tid = {};
        w.register(this, cid, this.tid);
        this.cid = cid;
    }

    [Symbol.dispose]() {
        clearInterval(this.cid);
        w.unregister(this.tid);
    }

    delete(key: any) {
        this.deletedEvent.dispatch(key);
        let item = this.map.get(key);
        if (item) {
            this.map.delete(key);
        } else {
            item = this.g1?.get(key);
            if (item) {
                this.g1.delete(key);
            } else {
                item = this.g2?.get(key);
                if (item) {
                    this.g2.delete(key);
                }
            }
        }
        if (!item) {
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
        this.clearExpired(Number.POSITIVE_INFINITY);
    }

    getOrCreate<TP>(key: TKey, p1: TP, factory: (k: TKey,p: TP) => T, ttl: number = 15000) {
        let item = this.get(key);
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
        let item = this.get(key);
        if (!item) {
            item = { value: factory(key), ttl, expire: Date.now() + ttl, dispose };
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
            item.expire = Date.now() + ttl;
        }
        return item.value;
    }

    private clearExpired(max = Date.now()): void {
        const old = this.g2;
        this.g2 = this.g1;
        this.g1 = this.map;
        this.map = new Map();
        if (!old) {
            return;
        }

        /**
         * Generation 2 is the oldest. So it is marked for removal.
         * Generation 1 is set to current map.
         * Map is set to new generation.
         * As recently fetched items will be inside Generation 1.
         * We will migrate old generation to Generation 1.
         */

        const expired = [];
        for (const entry of old.entries()) {
            if(entry[1].expire < max) {
                expired.push(entry);
            } else {
                // we will move oldest item to generation 1
                this.g1.set(entry[0], entry[1]);
            }
        }
        for (const [key, value] of expired) {
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

    private get(key) {
        let item = this.map.get(key);
        if (item) {
            return item;
        }
        item = this.g1?.get(key);
        if (item) {
            this.g1.delete(key);
            this.map.set(key, item);
            return item;
        }

        item = this.g2?.get(key);
        if (item) {
            this.g2.delete(key);
            this.map.set(key, item);
            return item;
        }
    }


}
