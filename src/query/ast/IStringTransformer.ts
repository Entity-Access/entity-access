import type QueryCompiler from "../../compiler/QueryCompiler.js";

export type ITextQueryFragment = string | ((p: any) => any) | { toString(): string };
export type ITextQuery = ITextQueryFragment[];

export type IStringTransformer = (s: string) => string;

export type ISqlMethodTransformer = (compiler: QueryCompiler, callee: string[], args: string[]) => string;

export class QueryParameter {

    static create(name: () => string) {
        return new QueryParameter(name);
    }

    constructor(public name: () => string) {}

    toString() {
        return this.name();
    }
}

export const joinMap = (sep: string, a: any[], fx?: (item) => any) => {
    const r = [];
    if (fx) {
        a = a.map(fx);
    }
    let s = "";
    for (const iterator of a) {
        if (s) {
            r.push(s);
        }
        s = sep;
        r.push(() => iterator);
    }
    return r;
};

export const prepareAny = (a: TemplateStringsArray, ... p: any[]): string[] => {
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

export const prepare = (a: TemplateStringsArray, ... p: (ITextQueryFragment | ITextQuery)[]): ITextQuery => {

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

export const prepareJoin = (a: (ITextQueryFragment | ITextQuery)[], sep: string = ","): ITextQuery => {
    const r = [];
    let first = true;
    for (const iterator of a) {
        if (!first) {
            if (sep) {
                r.push(sep);
            }
        }
        first = false;
        addNonEmptyFlat(r, iterator);
    }
    return r.flat(2);
};
