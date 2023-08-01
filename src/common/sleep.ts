export default async function sleep(n: number, signal?: AbortSignal, throwOnAbort = false) {
    if (signal?.aborted) {
        return;
    }
    return new Promise<void>((resolve, reject) => {
        const id = setTimeout(resolve, n);
        signal?.addEventListener("abort", () => {
            clearTimeout(id);
            if (throwOnAbort) {
                reject("cancelled");
                return;
            }
            resolve();
        });
    });
}