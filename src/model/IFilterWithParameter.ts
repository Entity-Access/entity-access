
export type IFilterWithParameter<P, T> = (p: P) => (x: T) => boolean;
