import Inject from "../../di/di.js";
import type EntityContext from "../EntityContext.js";
import { IEntityQuery } from "../IFilterWithParameter.js";
import ChangeEntry from "../changes/ChangeEntry.js";

const done = Promise.resolve() as Promise<void>;

export interface IForeignKeyFilter {
    for<T>(key: keyof T, filter: (q: IEntityQuery<T>) => IEntityQuery<T>): boolean;
}

export default abstract class EntityEvents<T> {

    filter(query: IEntityQuery<T>) {
        return query;
    }

    includeFilter(query: IEntityQuery<T>, type?: any, key?: string) {
        return this.filter(query);
    }

    modify(query: IEntityQuery<T>) {
        return this.filter(query);
    }

    delete(query: IEntityQuery<T>) {
        return this.modify(query);
    }

    beforeInsert(entity: T, entry: ChangeEntry) {
        return done;
    }

    onForeignKeyFilter(filter: IForeignKeyFilter) {

    }

    afterInsert(entity: T, entry: ChangeEntry) {
        return done;
    }

    beforeUpdate(entity: T, entry: ChangeEntry) {
        return done;
    }

    afterUpdate(entity: T, entry: ChangeEntry) {
        return done;
    }

    beforeDelete(entity: T, entry: ChangeEntry) {
        return done;
    }

    afterDelete(entity: T, entry: ChangeEntry) {
        return done;
    }

    beforeJson(entity: T) {
        return entity;
    }

}
