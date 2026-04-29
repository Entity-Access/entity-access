import EntityAccessError from "../../common/EntityAccessError.js";
import { IColumn, IEntityRelation } from "../../decorators/IColumn.js";
import NameParser from "../../decorators/parser/NameParser.js";
import EntityType from "../../entity-query/EntityType.js";
import DateTime from "../../types/DateTime.js";
import type ChangeSet from "./ChangeSet.js";

export const privateUpdateEntry = Symbol("updateEntry");

export const getContext = Symbol("updateEntry");

export interface IChanges {
    type: EntityType;
    entity: any;
    order: number;
    original: any;
    status: "detached" | "attached" | "inserted" | "modified" | "deleted" | "unchanged";
}

export interface IChange {
    column: IColumn;
    oldValue: any;
    newValue: any;
}

export default class ChangeEntry<T = any> implements IChanges {

    type: EntityType;
    entity: T;
    order: number;
    original: any;
    status: "detached" | "attached" | "inserted" | "modified" | "deleted" | "unchanged";

    modified: Map<IColumn, IChange>;
    updated: Map<IColumn, IChange>;

    changeSet: ChangeSet;

    private pending: (() => void)[];

    private dependents: Set<ChangeEntry>;

    constructor(p: IChanges, changeSet: ChangeSet) {
        Object.setPrototypeOf(p, ChangeEntry.prototype);
        const ce = p as ChangeEntry;
        ce.changeSet = changeSet;
        ce.pending = [];
        ce.dependents = new Set();
        ce.modified = new Map();
        ce.order = 1;
        return ce;
    }

    /**
     * Returns true if the field is modified
     * @param field property of the entity
     * @returns true/false
     */
    public isModified(field: keyof T) {
        const column = this.type.getField(field as string);
        return this.modified?.has(column) ?? false;
    }

    /**
     * Returns change made to specified field...
     * @param field field of type
     * @returns change or null
     */
    public getChange(field: keyof T) {
        const column = this.type.getField(field as string);
        const change = this.modified?.get(column) ?? null;
        return change;
    }

    /**
     * Returns true if the field was updated in the database
     * @param field property of the entity
     * @returns true/false
     */
    public isUpdated(field: keyof T) {
        const column = this.type.getField(field as string);
        return this.updated?.has(column) ?? false;
    }

    public detect() {

        if (this.status === "deleted") {
            return;
        }

        const { type: { columns, keys }, entity } = this;
        let { original } = this;

        if (original === void 0) {

            // check if all keys are set or not...

            let keysSet = true;
            let autoGenerate = false;
            for (const iterator of keys) {
                autoGenerate ||= iterator.generated as unknown as boolean;
                if(entity[iterator.name] === void 0) {
                    keysSet = false;
                }
            }

            if (keysSet) {
                if (!autoGenerate) {
                    this.status = "inserted";
                    this.detectDependencies();
                    return;
                }
            } else if (autoGenerate) {
                this.status = "inserted";
                this.detectDependencies();
                return;
            }

            this.original = { ... entity };
            original = this.original;
        }

        this.detectDependencies();

        for (const iterator of columns) {
            const oldValue = original[iterator.name];
            const newValue = entity[iterator.name];
            if (newValue !== oldValue) {
                if (!iterator.columnName) {
                    throw new EntityAccessError(`Column name for ${iterator.name} not set`);
                }
                // we need to fix date comparison issue
                if (newValue && oldValue && /^DateTime/.test(iterator.dataType)) {
                    const newValueDT = DateTime.from(newValue);
                    const oldValueDT = DateTime.from(oldValue);
                    if (newValueDT.msSinceEpoch === oldValueDT.msSinceEpoch) {
                        continue;
                    }
                }
                let modifiedEntry = this.modified.get(iterator);
                if (!modifiedEntry) {
                    modifiedEntry = { column: iterator, oldValue, newValue };
                    this.modified.set(iterator, modifiedEntry);
                } else {
                    modifiedEntry.oldValue = oldValue;
                    modifiedEntry.newValue = newValue;
                }
            }
        }

        if (this.status === "inserted") {
            return;
        }

        if (this.modified.size > 0) {
            this.status = "modified";
        } else {
            this.status = "unchanged";
        }
    }

    public async loadNavigationAsync(property: (item: T) => any) {
        const context = this.changeSet[getContext];
        const name = NameParser.parseMember(property);
        const { relation } = this.type.getProperty(name);
        if (!relation) {
            throw new EntityAccessError(`No relation found`);
        }

        const { relatedEntity } = relation;

        if (relation.isInverseRelation) {

            const inverse = this.entity[relation.name];

            if (inverse && !Array.isArray(inverse)) {
                return;
            }

            // we will just try to load all inverse items...
            // this is tricky as we need to build inverse query...
            const { relatedRelation } = relation;
            const filter = [];
            for (const { fkColumn, relatedKeyColumn } of relatedRelation.fkMap) {
                filter.push(`x.${fkColumn.name} === p.${relatedKeyColumn.name}`);
            }

            const query = `(x, p) => ${filter.join(" && ")}` as any;
            // console.log(query);

            await context.model.register(relatedEntity.typeClass)
                .where(this.entity, query)
                // .trace(console.log)
                .toArray();

            return;

        }

        if (this.entity[relation.name]) {
            return;
        }


        // need to setup inverse key check
        // const key = relatedEntity.keys[0];
        const keys = {} as any;
        // keys[key.name] = this.entity[relation.fkColumn.name];
        for (const { fkColumn, relatedKeyColumn } of relation.fkMap) {
            keys[relatedKeyColumn.name] = this.entity[fkColumn.name];
        }
        this.entity[relation.name] = await context.model.register(relatedEntity.typeClass).loadByKeys(keys);
    }

    public updateValues(dbValues) {
        if (!dbValues) {
            return this;
        }
        const { entity, type } = this;
        for (const iterator of type.columns) {
            const dbValue = dbValues[iterator.name];
            entity[iterator.name] = dbValue;
        }
        return this;
    }

    public apply(dbValues) {
        // apply values to main entity
        // set status to unchanged

        if(this.status === "deleted") {
            // remove...
            for (const iterator of this.pending) {
                iterator();
            }
            this.changeSet[privateUpdateEntry](this);
            return;
        }

        // we will only apply the columns defined
        if (dbValues !== void 0) {
            const { entity, type } = this;
            for (const key in dbValues) {
                if (Object.prototype.hasOwnProperty.call(dbValues, key)) {
                    const element = dbValues[key];
                    entity[key] = element;
                }
            }
            // const { entity, type } = this;
            // for (const iterator of type.columns) {
            //     const dbValue = dbValues[iterator.columnName];
            //     if (dbValue !== void 0) {
            //         entity[iterator.name] = dbValue;
            //     }
            // }
        }

        // we will set the identity key
        this.changeSet[privateUpdateEntry](this);

        for (const iterator of this.pending) {
            iterator();
        }

        this.setupInverseProperties();

        this.pending.length = 0;
        this.original = { ... this.entity };

        if (this.status === "modified") {
            this.updated = new Map(this.modified);
        }
        this.status = "unchanged";
        this.modified.clear();
    }

    public clearUpdated() {
        this.updated = null;
    }

    /**
     * This will cancel all pending changes will mark entry as unchanged.
     */
    public cancel() {
        this.pending.length = 0;
        const { entity, original } = this;
        if (original) {
            for (const key in original) {
                if (Object.prototype.hasOwnProperty.call(original, key)) {
                    const element = original[key];
                    entity[key] = element;
                }
            }
        }
        this.status = "unchanged";
        this.modified.clear();
    }


    detectDependencies() {
        const { type: { fkRelations, inverseRelations }, entity } = this;

        for (const iterator of fkRelations) {

            // get related entry..
            const related = entity[iterator.name];
            if (!related) {
                continue;
            }

            /**
             * We need to set prototype,
             *
             * Reason:
             * The prototype is not set when object is parsed from
             * JSON and changeSet requires type
             */
            const prototype = iterator.relatedTypeClass.prototype;
            if (Object.getPrototypeOf(related) !== prototype) {
                Object.setPrototypeOf(related, prototype);
            }

            this.order++;

            const relatedChanges = this.changeSet.getEntry(related);

            for (const { fkColumn, relatedKeyColumn } of iterator.fkMap) {
                const key = related[relatedKeyColumn.name];
                if (key === void 0 || key === null) {
                    relatedChanges.pending.push(() => {
                        this.entity[fkColumn.name] = related[relatedKeyColumn.name];
                    });
                } else {
                    this.entity[fkColumn.name] = key;
                }
            }
        }

        this.setupInverseProperties();
    }

    setupInverseProperties() {
        const deleted = this.status === "deleted";
        for (const iterator of this.type.inverseRelations) {
            const { relatedName } = iterator;
            const related = this.entity[iterator.name];
            if (related === void 0) {
                continue;
            }
            if (Array.isArray(related)) {
                if (deleted) {
                    this.pending.push(() => {
                        const index = related.indexOf(this.entity);
                        if (index !== -1) {
                            related.splice(index, 1);
                        }
                    });
                    continue;
                }

                for (const r of related) {
                    this.setInversePropertyValue(r, iterator);                }
                continue;
            }
            if (deleted) {
                this.pending.push(() => delete related[relatedName]);
                continue;
            }
            this.setInversePropertyValue(related, iterator);
        }
    }


    private setInversePropertyValue(related: any, { relatedName , relatedRelation }: IEntityRelation) {
        const { entity } = this;
        const re = this.changeSet.getEntry(related);
        re.order = this.order + 1;
        if (related[relatedName] !== entity) {
            related[relatedName] = entity;
        }
        if (this.status !== "inserted") {
            for (const { fkColumn , relatedKeyColumn } of relatedRelation.fkMap) {
                related[fkColumn.name] = entity[relatedKeyColumn.name];
            }
            return;
        }
        this.pending.push(() => {
            for (const { fkColumn , relatedKeyColumn } of relatedRelation.fkMap) {
                related[fkColumn.name] = entity[relatedKeyColumn.name];
            }
        });
    }

}
