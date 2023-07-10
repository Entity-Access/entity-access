import { IDisposable } from "./IDisposable.js";

export type IDisposableObject = IDisposable & { end?(): any; close?():any };

export type IDisposableObjectType = IDisposableObject | IDisposableObject[];


const disposeAll = async (all: (IDisposable & { end?(): any; close?():any })[]) => {
    let error = null;
    // we need to dispose in reverse order...
    while (all.length) {
        const d = all.pop();
        try {
            const f = d.dispose ?? d.end ?? d.close ?? d[Symbol.disposable] ?? d[Symbol.asyncDisposable];
            const r = f?.apply(d);
            if (r?.then) {
                await r;
            }
        } catch (e) {
            error = error
                ? new Error(`${error.stack ?? error}\r\n${e.stack ?? e}`)
                : error;
        }
    }
    if (error) {
        throw error;
    }
};

export default async function usingAsync<T>(fx: (registry: IDisposableObject[]) => T | Promise<T>) {
    const registry = [] as IDisposableObject[];
    try {
        const r = fx(registry) as any;
        if (r?.then) {
            await r;
        }
    } finally {
        await disposeAll(registry);
    }
}

export class DisposableScope {

    private disposables: IDisposableObject[] = [];

    public register(d: IDisposableObject) {
        this.disposables.push(d);
    }

    async dispose() {
        await disposeAll(this.disposables);
    }

}