export const cloner = {
    clone<T>(obj: T, symbols = false): T {
        const copy = {} as T;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const element = obj[key];
                if (element && Array.isArray(element)) {
                    copy[key] = [].concat(element) as any;
                    continue;
                }
                copy[key] = element;
            }
        }
        Object.setPrototypeOf(copy, Object.getPrototypeOf(obj));
        // copy symbols...
        if (symbols) {
            for (const iterator of Object.getOwnPropertySymbols(obj)) {
                copy[iterator] = obj[iterator];
            }
        }
        return copy;
    }
};