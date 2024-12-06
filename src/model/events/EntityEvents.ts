import JsonReadable from "../../common/JsonReadable.js";
import { IClassOf } from "../../decorators/IClassOf.js";
import NameParser from "../../decorators/parser/NameParser.js";
import Inject from "../../di/di.js";
import type  EntityType from "../../entity-query/EntityType.js";
import type EntityContext from "../EntityContext.js";
import { IEntityQuery } from "../IFilterWithParameter.js";
import ChangeEntry from "../changes/ChangeEntry.js";

const done = Promise.resolve() as Promise<void>;

export const entityNameSymbol = Symbol("Entity Name");

export class ForeignKeyFilter<T = any, TE = any> {

    public readonly type: EntityType;
    public readonly name: string;
    public readonly fkName: string;

    public readonly entity: TE;

    private events: EntityEvents<TE>;
    private context: EntityContext;

    constructor(p: Partial<ForeignKeyFilter> & { context: EntityContext, events: EntityEvents<any> }) {
        Object.setPrototypeOf(p, ForeignKeyFilter.prototype);
        return p as any as ForeignKeyFilter;
    }

    public is<TR>(fx: (x: T) => TR): this is ForeignKeyFilter<T, TR> & boolean {
        const name = NameParser.parseMember(fx);
        return name === this.fkName || name === this.name;
    }

    public read(): IEntityQuery<TE> {
        const read = this.context.query(this.type.typeClass);
        return this.events.filter(read);
    }

    public unfiltered(): IEntityQuery<TE> {
        return this.context.query(this.type.typeClass);
    }

    public modify(): IEntityQuery<TE> {
        const read = this.context.query(this.type.typeClass);
        return this.events.modify(read);
    }
}

export default class EntityEvents<T> {

    public get verify() {
        return true;
    }

    constructor(public readonly entityName = new.target[entityNameSymbol]) {
    }

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

    beforeInsert(entity: T, entry: ChangeEntry): void | Promise<void> {
        return done;
    }

    onForeignKeyFilter(filter: ForeignKeyFilter<T>) {
        return filter.modify();
    }

    afterInsert(entity: T, entry: ChangeEntry<T>): void | Promise<void> {
        return done;
    }

    beforeUpdate(entity: T, entry: ChangeEntry<T>): void | Promise<void> {
        return done;
    }

    afterUpdate(entity: T, entry: ChangeEntry<T>): void | Promise<void> {
        return done;
    }

    beforeDelete(entity: T, entry: ChangeEntry<T>): void | Promise<void> {
        return done;
    }

    afterDelete(entity: T, entry: ChangeEntry<T>): void | Promise<void> {
        return done;
    }

}
