export type ITextOrFunction = string | ((p: any) => any);
export type ITextOrFunctionArray = ITextOrFunction[];

export type IStringTransformer = (s: string) => string;

export type ISqlMethodTransformer = (callee: string, args: string[]) => string;


export const prepareAny = (a: TemplateStringsArray, ... p: any[]): any => {
    const r = [];
    for (let index = 0; index < a.length; index++) {
        const element = a[index];
        r.push(element);
        if (index < p.length) {
            const pi = p[index];
            if (Array.isArray(pi)) {
                r.push(... pi);
                continue;
            }
            r.push(pi);
        }
    }
    return r.flat(2);
};

const addNonEmptyFlat = (array: any[], item: any) => {
    if (typeof item === "string") {
        if(item) {
            array.push(item);
            return;
        }
    }
    if (Array.isArray(item)) {
        for (const iterator of item) {
            if (typeof iterator === "string") {
                if (iterator) {
                    array.push(iterator);
                    continue;
                }
                continue;
            }
            array.push(iterator);
        }
        return;
    }
    array.push(item);
};

export const prepare = (a: TemplateStringsArray, ... p: (ITextOrFunction | ITextOrFunctionArray)[]): ITextOrFunctionArray => {

    const r = [];
    for (let index = 0; index < a.length; index++) {
        const element = a[index];
        addNonEmptyFlat(r, element);
        if (index < p.length) {
            const pi = p[index];
            addNonEmptyFlat(r, pi);
        }
    }
    return r.flat(2);
};

export const prepareJoin = (a: (ITextOrFunction | ITextOrFunctionArray)[], sep: string = ","): ITextOrFunctionArray => {
    const r = [];
    let first = true;
    for (const iterator of a) {
        if (!first) {
            r.push(",");
        }
        first = false;
        addNonEmptyFlat(r, iterator);
    }
    return r.flat(2);
};
