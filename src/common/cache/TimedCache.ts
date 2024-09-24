/* eslint-disable no-console */
import CustomEvent from "../CustomEvent.js";
import EventSet from "../EventSet.js";

const w = new FinalizationRegistry<any>((heldValue) => {
    clearInterval(heldValue);
});

export default class TimedCache<TKey = any, T = any> implements Disposable {

    public deletedEvent = new EventSet<TKey>(this);

    public addedEvent = new EventSet<{ key: TKey, value: T}>(this);

    private map: Map<TKey,{ value: any, expire: number, ttl: number, dispose?: (item: any) => any }> = new Map();

    private cid: NodeJS.Timer;

    constructor(private ttl = 15000) {
        const cid = setInterval((x) => x.clearExpired(), this.ttl, this);
        w.register(this, cid);
        this.cid = cid;
    }

    [Symbol.dispose]() {
        clearInterval(this.cid);
    }

    delete(key: any) {
        this.deletedEvent.dispatch(key);
        const item = this.map.get(key);
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
        this.map.delete(key);
    }

    /**
     * Delete all the keys from the cache
     * @param dispatchEvents dispatch deleted Event
     */
    clear() {
        this.clearExpired(Number.POSITIVE_INFINITY);
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

    private clearExpired(max = Date.now()): void {
        const expired = [];
        for (const entry of this.map.entries()) {
            if(entry[1].expire < max) {
                expired.push(entry);
            }
        }
        for (const [key, value] of expired) {
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
