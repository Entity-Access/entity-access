import ServiceCollection from "./ServiceCollection.js";

export default function Inject(target, key) {

    Object.defineProperty(target, key, {
        get() {
            const plist = (Reflect as any).getMetadata("design:type", target, key);
            const result = ServiceCollection.resolve(this, plist);
            // get is compatible with AtomWatcher
            // as it will ignore getter and it will
            // not try to set a binding refresher
            Object.defineProperty(this, key, {
                get: () => result
            });
            return result;
        },
        configurable: true
    });

}
