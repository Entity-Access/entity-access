export type IClassOf<T> = new (... a: any[]) => T;
export type IAbstractClassOf<T> = abstract new (... a: any[]) => T;
