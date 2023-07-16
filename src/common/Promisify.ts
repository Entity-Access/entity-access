export interface IPromisify {
    toPromise(fx: (cb: (error) => void) => void): Promise<void>;
    toPromise<T>(fx: (cb: (error, results: T) => void) => void): Promise<T>;
    toPromise<T>(fx: (cb: (error, results: T, extra?) => void) => void): Promise<{ results: T, extra: any}>;
}

export const Promisify: IPromisify = {
    toPromise(fx: (cb: (error, results?, extra?) => void) => void) {
        return new Promise((resolve, reject) => {
            fx((error, results, extra) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (results) {
                    if (extra) {
                        return resolve({ results, extra });
                    }
                    return resolve(results);
                }
            });
        });
    }
} as any;