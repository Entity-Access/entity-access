export interface ITimedCache<T> {
    getOrCreate<TKey>(key: TKey, factory: (k: TKey) => T, ttl?: number): T;
}

export default class TimedCache implements ITimedCache<any> {

    public static for<T>() {
        return this.instance as any as ITimedCache<T>;
    }

    private static instance = new TimedCache();

    private map: Map<any,{ value:any, expire: number, ttl: number }> = new Map();

    private constructor() {
        // intentional
        setInterval((x) => x.clear(), 15000, this);
    }

    clear(): void {
        const expired = [];
        const now = Date.now();
        for (const [key, value] of this.map.entries()) {
            if(value.expire < now) {
                expired.push(key);
            }
        }
        for (const key of expired) {
            this.map.delete(key);
        }
    }

    getOrCreate<TKey>(key: TKey, factory: (k: TKey) => any, ttl: number = 1500) {
        let item = this.map.get(key);
        if (!item) {
            item = { value: factory(key), ttl, expire: Date.now() + ttl };
            this.map.set(key, item);
        } else {
            item.expire = Date.now() + ttl;
        }
        return item.value;
    }


}
