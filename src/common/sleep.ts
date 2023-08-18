export default async function sleep(n: number, signal?: AbortSignal, throwOnAbort = false) {
    if (signal?.aborted) {
        return;
    }
    return new Promise<void>((resolve, reject) => {
        if (!signal) {
            setTimeout(resolve, n);
            return;
        }
        let resolved = false;
        const old = resolve;
        resolve = () => {
            if (resolved) {
                return;
            }
            resolved = true;
            old();
        };
        const oldReject = reject;
        reject = (r) => {
            if (resolved) {
                return;
            }
            resolved = true;
            oldReject(r);
        };
        const id = setTimeout(resolve, n);
        signal.onabort = () => {
            clearTimeout(id);
            if (throwOnAbort) {
                reject("cancelled");
                return;
            }
            resolve();
        };
    });
}