import { ISql } from "../sql/ISql.js";

type IFunction = ( ... a: any[]) => any;

type others = Omit<ISql, "in">;

type IStringReturn<T extends IFunction> = (... p: Parameters<T>) => string;

type transformed<T> = {
    [P in keyof T]: T[P] extends IFunction ? IStringReturn<T[P]> : transformed<T[P]>;
};

export type ISqlHelpers = transformed<ISql>;