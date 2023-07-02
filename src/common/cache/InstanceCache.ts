export default function InstanceCache(target: any, key: string): void {

    Object.defineProperty(target, key, {
        get() {
            const value = this[key];
            Object.defineProperty(this, key, {
                value,
            });
            return value;
        },
        configurable: true
    });

}