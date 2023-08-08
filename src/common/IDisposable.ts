/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/naming-convention */
declare global {
    interface SymbolConstructor {
        readonly disposable?: unique symbol;
        readonly asyncDisposable?: unique symbol;
    }
}

// @ts-expect-error readonly
Symbol.disposable ??= Symbol("@@disposable");
// @ts-expect-error readonly
Symbol.asyncDisposable ??= Symbol("@@asyncDisposable");


export interface IDisposable {
    dispose?();
    [Symbol.disposable]?();
    [Symbol.asyncDisposable]?();
}

export function disposeDisposable(d: IDisposable) {
    const f = (d[Symbol.disposable] ?? d[Symbol.asyncDisposable]) as (...a: any) => any;
    f?.call(d)?.catch((error) => console.error(error.stack ?? error));
}