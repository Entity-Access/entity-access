import { IClassOf } from "../../decorators/IClassOf.js";
import NameParser from "../../decorators/parser/NameParser.js";
import Inject from "../../di/di.js";
import type  EntityType from "../../entity-query/EntityType.js";
import type EntityContext from "../EntityContext.js";
import { IEntityQuery } from "../IFilterWithParameter.js";
import ChangeEntry from "../changes/ChangeEntry.js";

const done = Promise.resolve() as Promise<void>;

export class ForeignKeyFilter<T = any> {

    public type: EntityType;
    public name: string;
    public fkName: string;

    private events: EntityEvents<any>;
    private context: EntityContext;

    constructor(p: Partial<ForeignKeyFilter> & { context: EntityContext, events: EntityEvents<any> }) {
        Object.setPrototypeOf(p, ForeignKeyFilter.prototype);
        return p as any as ForeignKeyFilter;
    }

    public is<TR>(fx: (x: T) => TR): boolean {
        const name = NameParser.parseMember(fx);
        return name === this.fkName || name === this.name;
    }

    public read() {
        const read = this.context.query(this.type.typeClass);
        return this.events.filter(read);
    }

    public modify() {
        const read = this.context.query(this.type.typeClass);
        return this.events.modify(read);
    }
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

    onForeignKeyFilter(filter: ForeignKeyFilter<T>) {
        return filter.modify();
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
