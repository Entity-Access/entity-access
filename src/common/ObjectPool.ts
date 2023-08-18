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
    poolSize?: number;

    /**
     * Default is 50
     */
    maxSize?: number;

    /**
     * Max wait in milliseconds before creating
     * new object, default is 5 seconds
     */
    maxWait?: number;

    logger?: (text: string) => void;
}

const poolSymbol = Symbol("pool");

export type IPooledObject<T> = T & {
    [Symbol.asyncDisposable](): Promise<any>;
    [poolSymbol]: ObjectPool<T>;
};

/**
 * Most pool implementations are poor and are having too many errors.
 */
export default class ObjectPool<T> {

    public get freeSize() {
        return this.free.length;
    }


    public get currentSize() {
        return this.total;
    }

    private factory: () => T;

    private asyncFactory: () => Promise<T>;

    private destroy: (item: T) => any;

    private subscribeForRemoval: (po: IPooledObject<T>, clear: () => void ) => void;

    private maxSize: number;

    private poolSize: number;

    private maxWait: number;

    private free: T[] = [];

    private total: number = 0;

    private awaited: Set<AbortController> = new Set();

    private logger: (text: string) => void;

    constructor({
        maxSize = 40,
        maxWait = 5000,
        poolSize = 20,
        logger,
        asyncFactory,
        factory,
        destroy,
        subscribeForRemoval
    }: IObjectPool<T>) {
        this.maxSize = maxSize;
        this.maxWait = maxWait;
        this.poolSize = poolSize;
        this.asyncFactory = asyncFactory;
        this.factory = factory;
        this.destroy = destroy;
        this.subscribeForRemoval = subscribeForRemoval;
        this.logger = logger;
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
        let existing = this.free.pop();
        if(!existing) {
            if (this.total >= this.poolSize) {
                const a = new AbortController();
                this.awaited.add(a);
                await sleep(this.maxWait, a.signal);
                this.awaited.delete(a);
                existing = this.free.pop();
            }
        }
        if(existing) {
            return existing as IPooledObject<T>;
        }

        if (this.total >= this.maxSize) {
            throw new EntityAccessError(`Maximum size of pool reached. Retry after sometime.`);
        }
        this.total++;

           // create new..
        const item = this.factory?.() ?? (await this.asyncFactory());
        this.subscribeForRemoval(item as unknown as any, () => {
            const index = this.free.indexOf(item);
            this.free.splice(index, 1);
        });

        const pooledItem = item as IPooledObject<T>;
        pooledItem[poolSymbol] = this;
        pooledItem[Symbol.asyncDisposable] = async () => {
            // delete this[Symbol.asyncDisposable];
            this.logger?.(`Pooled item ${pooledItem} freed.`);
            if (this.free.length < this.poolSize) {
                this.free.push(pooledItem);
                for (const iterator of this.awaited) {
                    this.awaited.delete(iterator);
                    iterator.abort();
                    return;
                }
                return;
            }
            this.total--;
            void this.destroy(pooledItem)?.catch(console.error);
        };
        this.logger?.(`Pooled item ${pooledItem} acquired.`);
        this.logger?.(`Item ${pooledItem} has disposable ${typeof pooledItem[Symbol.asyncDisposable]}`);
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