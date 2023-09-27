export default class Waiter {

    public static create() {
        return new Waiter();
    }

    public static releaseAll() {
        const copy = Array.from(this.set);
        this.set.clear();
        for (const iterator of copy) {
            iterator.controller.abort();
        }
    }

    private static set = new Set<Waiter>();

    constructor(private controller = new AbortController(), public readonly signal = controller.signal) {
    }

    [Symbol.dispose]() {
        Waiter.set.delete(this);
    }

}
