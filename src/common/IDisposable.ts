/* eslint-disable no-console */

import EALogger from "./EALogger.js";

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
    f?.call(d)?.catch((error) => EALogger.error(error.stack ?? error));
}