import CustomEvent from "./CustomEvent.js";
// Making sure that Symbol.dispose is not undefined
import "./IDisposable.js";

export interface IEventSetArgs<T,TArg> {
    target: T;
    detail: TArg;
}

export default class EventSet<TArg, Target = any> {

    public listeners: Set<((x: IEventSetArgs<Target, TArg>) => any)>;

    constructor(private readonly owner: Target) {

    }

    listen(listener: (x: IEventSetArgs<Target, TArg>) => any) {
        this.listeners ??= new Set();
        this.listeners.add(listener);
        return {
            [Symbol.dispose]: () => this.listeners.delete(listener)
        };
    }

    listenOnce(listener: (x: IEventSetArgs<Target, TArg>) => any) {
        this.listeners ??= new Set();
        const old = listener;
        listener = (x) => {
            old(x);
            this.listeners.delete(listener);
        };
        this.listeners.add(listener);
        return {
            [Symbol.dispose]: () => this.listeners.delete(listener)
        };
    }

    remove(listener: (x: IEventSetArgs<Target, TArg>) => any) {
        this.listeners.delete(listener);
    }

    dispatch(detail: TArg) {
        if (!this.listeners) {
            return detail;
        }
        const arg = { target: this.owner, detail };
        for (const iterator of this.listeners.values()) {
            iterator(arg);
        }
        return detail;
    }


}