
export type IFilterWithParameter<P = any, T = any> = (p: P) => (x: T) => boolean;

export type ILambdaExpression<P = any, T = any, TR = any> = [input: P, x: (p: P) => (s: T) => TR];

export type IFilterExpression<P = any, T = any> = [input: P, x: (p: P) => (s: T) => boolean];

export interface IBaseQuery<T> {
    where<P>(parameters: P, fx: IFilterExpression<P, T>);
    enumerate(): AsyncGenerator<T>;
    firstOrFail(): Promise<T>;
    first(): Promise<T>;
}

export interface IOrderedEntityQuery<T> extends IBaseQuery<T> {
    thenBy<P, TR>(parameters: P, fx: ILambdaExpression<P, T, TR>);
    thenByDescending<P, TR>(parameters: P, fx: ILambdaExpression<P, T, TR>);
}

export interface IEntityQuery<T> extends IBaseQuery<T> {
    orderBy<P, TR>(parameters: P, fx: ILambdaExpression<P, T, TR>);
    orderByDescending<P, TR>(parameters: P, fx: ILambdaExpression<P, T, TR>);
}