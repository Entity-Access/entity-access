import { IQueryResult } from "../drivers/base/BaseDriver.js";
import type { EntitySource } from "./EntitySource.js";

export type IFilterWithParameter<P = any, T = any> = (p: P) => (x: T) => boolean;

export type ILambdaExpression<P = any, T = any, TR = any> = [input: P, x: (p: P) => (s: T) => TR];

export type IFilterExpression<P = any, T = any> = [input: P, x: (p: P) => (s: T) => boolean];

export type IFieldsAsNumbers<T> = { [P in keyof T]: number };

export interface IBaseQuery<T> {
    enumerate(this: T extends object ? IBaseQuery<T> : never): AsyncGenerator<T>;

    firstOrFail(this: T extends object ? IBaseQuery<T> : never, errorMessage?: string): Promise<T>;
    first(this: T extends object ? IBaseQuery<T> : never): Promise<T>;

    some(): Promise<boolean>;

    select<P, TR>(parameters: P, fx: (p: P) => (x: T) => TR): IBaseQuery<TR>;
    map<P, TR>(parameters: P, fx: (p: P) => (x: T) => TR): IBaseQuery<TR>;

    toArray(this: T extends object ? IBaseQuery<T> : never): Promise<T[]>;

    toQuery(): { text: string, values: any[]};

    limit<DT>(this: DT, limit: number): DT;
    offset<DT>(this: DT, offset: number): DT;
    where<P, DT>(this: DT, parameters: P, fx: (p: P) => (x: T) => boolean): DT;
    union<P, DT>(this: DT, parameters: P, fx: (p: P) => (x: T) => boolean): DT;
    selectView<P, DT>(this: DT, parameters: P, fx: (p: P) => (x: T) => Partial<T>): DT;

    innerJoin<JT, DT>(this: DT, q1: IBaseQuery<JT>, fx: (p: JT) => (x: T) => boolean): DT;

    exists<JT, DT>(this: DT, q1: IBaseQuery<JT>, fx: (p: JT) => (x: T) => boolean): DT;

    count(): Promise<number>;
    count<P>(parameters: P, fx: (p: P) => (x: T) => boolean): Promise<number>;

    slice<DT>(this:DT, start?: number, end?: number): DT;

    sum(): Promise<number>;
    sum<P>(parameters: P, fx: (p: P) => (x: T) => number): Promise<number>;
    sum<P, TR>(parameters: P, fx: (p: P) => (x: T) => TR): Promise<IFieldsAsNumbers<TR>>;


    withSignal<DT>(this:DT, signal: AbortSignal): DT;

    include<TR>(fx: (x: T) => TR | TR[]): IBaseQuery<T>;

    update<P>(parameters: P, fx: (p: P) => (x:T) => Partial<T>): Promise<number>;
    updateSelect<P>(this: T extends object ? IBaseQuery<T> : never, parameters: P, fx: (p: P) => (x:T) => Partial<T>): Promise<T[]>;

    /**
     * Warning !! Be careful, this will delete rows from the database and neither soft delete nor any other events will be invoked.
     * @param parameters parameters to supply
     * @param fx filter expression
     */
    delete<P>(parameters: P, fx: (p: P) => (x: T) => boolean): Promise<number>;

    trace<DT>(this: DT, tracer: (text: string) => void): DT;

    unionsAll<DT>(this: DT, ... p: DT[]): DT;
    unions<DT>(this: DT, ... p: DT[]): DT;

    /**
     * Inserts current sql statement into given entity source.
     * @param this query
     * @param destination entity source
     */
    insertInTo<DT>(this: DT, destination: EntitySource<Partial<T>>): Promise<IQueryResult>;
}

export interface IOrderedEntityQuery<T> extends IBaseQuery<T> {

    thenBy<P>(parameters: P, fx: (p: P) => (x: T) => any): IOrderedEntityQuery<T>;
    thenByDescending<P>(parameters: P, fx: (p: P) => (x: T) => any): IOrderedEntityQuery<T>;
}

export interface IEntityQuery<T> extends IBaseQuery<T> {

    orderBy<P>(parameters: P, fx: (p: P) => (x: T) => any): IOrderedEntityQuery<T>;
    orderByDescending<P>(parameters: P, fx: (p: P) => (x: T) => any): IOrderedEntityQuery<T>;
}