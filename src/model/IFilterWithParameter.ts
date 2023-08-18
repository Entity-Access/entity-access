
export type IFilterWithParameter<P = any, T = any> = (p: P) => (x: T) => boolean;

export type ILambdaExpression<P = any, T = any, TR = any> = [input: P, x: (p: P) => (s: T) => TR];

export type IFilterExpression<P = any, T = any> = [input: P, x: (p: P) => (s: T) => boolean];

export interface IBaseQuery<T> {
    enumerate(): AsyncGenerator<T>;

    firstOrFail(): Promise<T>;
    first(): Promise<T>;

    select<P, TR>(parameters: P, fx: (p: P) => (x: T) => TR): IBaseQuery<TR>;
    map<P, TR>(parameters: P, fx: (p: P) => (x: T) => TR): IBaseQuery<TR>;

    toArray(): Promise<T[]>;

    toQuery(): { text: string, values: any[]};

    limit<DT>(this: DT, limit: number): DT;
    offset<DT>(this: DT, offset: number): DT;
    where<P, DT>(this: DT, parameters: P, fx: (p: P) => (x: T) => boolean): DT;

    count(): Promise<number>;
    count<P>(parameters: P, fx: (p: P) => (x: T) => boolean): Promise<number>;

    sum(): Promise<number>;
    sum<P>(parameters: P, fx: (p: P) => (x: T) => number): Promise<number>;

    withSignal<DT>(this:DT, signal: AbortSignal): DT;

    include<TR>(fx: (x: T) => TR | TR[]): IBaseQuery<T>;

    trace<DT>(tracer: (this: DT, text: string) => void): DT;
}

export interface IOrderedEntityQuery<T> extends IBaseQuery<T> {

    thenBy<P>(parameters: P, fx: (p: P) => (x: T) => any): IOrderedEntityQuery<T>;
    thenByDescending<P>(parameters: P, fx: (p: P) => (x: T) => any): IOrderedEntityQuery<T>;
}

export interface IEntityQuery<T> extends IBaseQuery<T> {

    orderBy<P>(parameters: P, fx: (p: P) => (x: T) => any): IOrderedEntityQuery<T>;
    orderByDescending<P>(parameters: P, fx: (p: P) => (x: T) => any): IOrderedEntityQuery<T>;
}