import EntityAccessError from "../common/EntityAccessError.js";
import type { ISqlMethodTransformer } from "../query/ast/IStringTransformer.js";
import { ISql } from "../sql/ISql.js";
import type QueryCompiler from "./QueryCompiler.js";

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

export const flattenMethods = (m: any): ISqlMethodTransformer => {

    const map = new Map<string, (...a) => any>();

    const fillMap = (target, root = "Sql") => {
        for (const key in target) {
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                const element = target[key];
                if (typeof element === "object") {
                    fillMap(element, root + "." + key);
                    continue;
                }
                if (typeof element === "function") {
                    map.set(root + "." + key, element);
                }
            }
        }
    };

    fillMap(m);

    return (compiler: QueryCompiler, method: string, args: string[]) => {
        const fx = map.get(method);
        if (!fx) {
            throw new EntityAccessError(`Invalid method ${method}`);
        }
        return fx.apply(compiler, args);
    };
};