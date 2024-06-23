import type { EntitySource } from "../model/EntitySource.js";
import { IBaseQuery } from "../model/IFilterWithParameter.js";

type IEntity<T> = T extends EntitySource<infer R> ? R : never;

type ReWriteQuery<T> = {
    [p in keyof T]: IBaseQuery<IEntity<T[p]>>;
};

export default interface ITrigger<T1 = any, T = any> {
    name: string,
    afterInsertOrUpdate?: (this:  ReWriteQuery<T1>, x: T) => any;
    afterInsert?: (this:  ReWriteQuery<T1>, x: T) => any;
}