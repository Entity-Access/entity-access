import type EntityContext from "./EntityContext.js";
import { IClassOf } from "../decorators/IClassOf.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import { EntitySource } from "./EntitySource.js";
import { BaseDriver } from "../drivers/base/BaseDriver.js";
import EntityType from "../entity-query/EntityType.js";
import { IStringTransformer } from "../query/ast/IStringTransformer.js";
import { IEntityRelation } from "../decorators/IColumn.js";

const driverModelCache = Symbol("driverModelCache");

const getOrCreateModel = (map: Map<any, EntityType>, type: IClassOf<any>, namingConvention: IStringTransformer) => {
    let t = map.get(type);
    if (t) {
        return t;
    }
    const original = SchemaRegistry.model(type);
    t = new EntityType(original, namingConvention);
    map.set(type,  t);
    for (const iterator of original.columns) {
        const column = { ... iterator };
        column.columnName = column.explicitName
            ? column.columnName
            : (namingConvention
                    ? namingConvention(column.columnName) : column.columnName);
        column.entityType = t;
        t.addColumn(column);
    }
    t.indexes.push(... original.indexes.map((i) => ({ ... i, columns: [ ... i.columns.map((c) => ( { ... c}))] })));
    // sort keys...
    if (t.keys.length > 1) {
        t.keys.sort((a, b) => a.order - b.order);
    }
    for (const iterator of original.relations) {
        if (!iterator.relatedTypeClass) {
            iterator.relatedTypeClass = iterator.relatedTypeClassFactory();
        }
        if (iterator.isInverseRelation) {
            continue;
        }
        const relation: IEntityRelation = { ... iterator, relatedEntity: void 0,type: t };
        t.addRelation(relation, (tc) => getOrCreateModel(map, tc, namingConvention));
    }
    return t;
};

export default class EntityModel {

    public sources: Map<IClassOf<any>, EntitySource> = new Map();

    public types: Map<IClassOf<any>, EntityType> = new Map();

    constructor(private context: EntityContext) {
    }

    register<T>(type: IClassOf<T>) {
        let source = this.sources.get(type);
        if (!source) {
            const cache = (this.context.driver[driverModelCache] ??= new Map());
            const entityType = getOrCreateModel(
                cache,
                type,
                this.context.driver.compiler.namingConvention
            );
            this.types.set(type, entityType);
            source = new EntitySource(entityType, this.context);
            this.sources.set(type, source);
        }
        return source as EntitySource<T>;
    }

    getEntityType<T>(type: IClassOf<T>): EntityType{
        return this.types.get(type);
    }

}
