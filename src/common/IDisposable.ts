/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/naming-convention */
declare global {
    interface SymbolConstructor {
        readonly dispose?: unique symbol;
        readonly asyncDispose?: unique symbol;
    }
}

// @ts-expect-error readonly
Symbol.dispose ??= Symbol("@@disposable");
// @ts-expect-error readonly
Symbol.asyncDispose ??= Symbol("@@asyncDisposable");


export interface IDisposable {
    dispose?();
    [Symbol.dispose]?();
    [Symbol.asyncDispose]?();
}

export function disposeDisposable(d: IDisposable) {
    const f = (d[Symbol.dispose] ?? d[Symbol.asyncDispose]) as (...a: any) => any;
    f?.call(d)?.catch((error) => console.error(error.stack ?? error));
}