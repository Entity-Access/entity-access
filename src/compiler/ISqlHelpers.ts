import { ISql } from "../sql/ISql.js";

type IFunction = ( ... a: any[]) => any;

type others = Omit<ISql, "in">;

type IStringReturn<T extends IFunction> = (... p: Parameters<T>) => string[];

type transformed<T> = {
    [P in keyof T]: T[P] extends IFunction ? IStringReturn<T[P]> : transformed<T[P]>;
};

export type ISqlHelpers = transformed<ISql>;

export const flattenHelpers = (f, name, target = {}) => {
    for (const key in f) {
        if (Object.prototype.hasOwnProperty.call(f, key)) {
            const element = f[key];
            if (typeof element === "function") {
                target[name + "." + key] = element;
                continue;
            }
            if (typeof element !== "object") {
                continue;
            }
            flattenHelpers(element, name + "." + key, target);
        }
    }
    return target;
};
