
export interface IDisposable {

    end?():any;
    dispose?(): any;
    close?(): any;

}


export default async function usingAsync<T extends IDisposable>(d: T, fx: (p:T) => Promise<any>) {
    try {
        const r = fx(d);
        if (r?.then) {
            await r;
        }
        return r;
    } finally {
        const r = d.dispose?.() ?? d.end?.() ?? d.close?.();
        if (r?.then) {
            await r;
        }
    }
}
