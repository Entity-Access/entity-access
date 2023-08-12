/* eslint-disable no-console */
import EntityAccessError from "./EntityAccessError.js";
import TimedCache from "./cache/TimedCache.js";
import sleep from "./sleep.js";

interface IObjectPool<T> {
    factory?: () => T;
    asyncFactory?: () => Promise<T>;
    destroy: (item: T) => any;

    subscribeForRemoval: (po: IPooledObject<T>, clear: () => void) => void;

    /**
     * Max Number of Pooled objects, default is 20
     */
    size?: number;

    /**
     * Default is 50
     */
    max?: number;

    /**
     * Max wait in milliseconds before creating
     * new object, default is 15 seconds with gap of 1 second each
     */
    maxWait?: number;
}

export type IPooledObject<T> = T & { [Symbol.asyncDisposable](): Promise<any>; };

/**
 * Most pool implementations are poor and are having too many errors.
 */
export default class ObjectPool<T> {

    private factory: () => T;

    private asyncFactory: () => Promise<T>;

    private destroy: (item: T) => any;

    private subscribeForRemoval: (po: IPooledObject<T>, clear: () => void ) => void;

    private size: number;

    private max: number;

    private maxWait: number;

    private free: T[] = [];

    private total: number;

    private awaited: Set<AbortController>;

    constructor(p: IObjectPool<T>) {
        Object.setPrototypeOf(p, ObjectPool.prototype);
        p.max ||= 20;
        p.maxWait ||= 15000;
        p.size ||= 50;
        const r = p as unknown as ObjectPool<T>;
        r.total = 0;
        r.awaited = new Set();
        r.free = [];
        return p as unknown as ObjectPool<T>;
    }

    public async dispose() {
        const copy = [].concat(this.free);
        this.free = [];
        for (const iterator of this.awaited) {
            iterator.abort();
        }
        this.awaited.clear();
        for (const iterator of copy) {
            await this.destroy(iterator);
        }
    }

    public async acquire(): Promise<IPooledObject<T>> {
        let item = this.free.pop();
        if(!item) {
            if (this.total > this.size) {
                const a = new AbortController();
                this.awaited.add(a);
                await sleep(this.maxWait, a.signal);
                this.awaited.delete(a);
                item = this.free.pop();
            }
        }
        if(!item) {
            // create new..
            if (this.factory) {
                item = this.factory();
            } else {
                item = await this.asyncFactory();
            }
            this.subscribeForRemoval(item as unknown as any, () => {
                const index = this.free.indexOf(item);
                this.free.splice(index, 1);
            });
            if (this.total >= this.max) {
                throw new EntityAccessError(`Maximum size of pool reached.`);
            }
            this.total++;
        }
        const pooledItem = item as IPooledObject<T>;
        pooledItem[Symbol.asyncDisposable] = async () => {
            if (this.free.length < this.max) {
                this.free.push(item);
                for (const iterator of this.awaited) {
                    this.awaited.delete(iterator);
                    iterator.abort();
                    break;
                }
            } else {
                await this.destroy(item);
                this.total--;
            }
        };
        return item as IPooledObject<T>;
    }

}

export class NamedObjectPool<T> {

    private namedCache: TimedCache<string, ObjectPool<any>> = new TimedCache();

    constructor(private config: (key: string) => IObjectPool<T>) {

    }

    async acquire(key: string): Promise<IPooledObject<T>> {
        const pool = this.namedCache.getOrCreate(key, this.config, (k, c) => new ObjectPool<T>(c(k)));
        return pool.acquire();
    }

}