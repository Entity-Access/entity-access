import { IDisposable } from "./IDisposable.js";

export interface IDisposableObject extends IDisposable {

    end?():any;
    close?(): any;

}


export default async function usingAsync<T extends IDisposableObject>(d: T, fx: (p:T) => Promise<any>) {
    try {
        const r = fx(d);
        if (r?.then) {
            await r;
        }
        return r;
    } finally {
        const f = d.dispose ?? d.end ?? d.close ?? d[Symbol.disposable] ?? d[Symbol.asyncDisposable];
        const r = f?.apply(d);
        if (r?.then) {
            await r;
        }
    }
}
