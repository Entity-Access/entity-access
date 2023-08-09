import { IColumn } from "../../decorators/IColumn.js";
import EntityType from "../../entity-query/EntityType.js";
import type ChangeSet from "./ChangeSet.js";
import { privateUpdateEntry } from "./ChangeSet.js";

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
        return ce;
    }

    /**
     * Returns true if the field is modified
     * @param field property of the entity
     * @returns true/false
     */
    public isModified(field: keyof T) {
        const column = this.type.getColumn(field as string);
        return this.modified.has(column);
    }

    /**
     * Returns true if the field was updated in the database
     * @param field property of the entity
     * @returns true/false
     */
    public isUpdated(field: keyof T) {
        const column = this.type.getColumn(field as string);
        return this.updated.has(column);
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
                autoGenerate ||= iterator.autoGenerate;
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
            if (entity[iterator.name] !== original[iterator.name]) {
                let modifiedEntry = this.modified.get(iterator);
                if (!modifiedEntry) {
                    modifiedEntry = { column: iterator, oldValue, newValue };
                    this.modified.set(iterator, modifiedEntry);
                }
            }
        }


        if (this.modified.size > 0) {
            this.status = "modified";
        } else {
            this.status = "unchanged";
        }
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
            for (const iterator of this.type.columns) {
                const dbValue = dbValues[iterator.columnName];
                if (dbValue !== void 0) {
                    this.entity[iterator.name] = dbValues[iterator.columnName];
                }
            }
        }

        for (const iterator of this.pending) {
            iterator();
        }

        // we will set the identity key
        this.changeSet[privateUpdateEntry](this);

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
        const { type: { relations }, entity } = this;
        // for parent relations.. check if related key is set or not...
        for (const iterator of relations) {
            if (iterator.isInverseRelation) {
                continue;
            }

            // get related entry..
            const related = entity[iterator.name];
            if (!related) {
                continue;
            }

            // if related has key defined.. set it...
            const rKey = iterator.relatedEntity.keys[0];

            // lets set the prototype...
            const prototype = iterator.relatedTypeClass.prototype;
            if (Object.getPrototypeOf(related) !== prototype) {
                Object.setPrototypeOf(related, prototype);
            }
            const relatedChanges = this.changeSet.getEntry(related);

            const keyValue = related[rKey.name];
            if (keyValue === void 0) {

                if(relatedChanges.dependents.has(this)) {
                    continue;
                }
                relatedChanges.dependents.add(this);

                this.order++;

                for (const d of this.dependents) {
                    d.order++;
                }

                const fk = iterator;
                relatedChanges.pending.push(() => {
                    this.entity[fk.fkColumn.name] = related[rKey.name];
                });
                if (this.status !== "inserted") {
                    this.modified.set(iterator, { column: iterator.fkColumn, oldValue: void 0, newValue: void 0});
                }
                continue;
            }

            this.entity[iterator.fkColumn.name] = related[rKey.name];
        }
    }

    setupInverseProperties() {
        const deleted = this.status === "deleted";
        for (const iterator of this.type.relations) {
            if (!iterator.isInverseRelation) {
                continue;
            }
            const { relatedName } = iterator;
            const related = this.entity[iterator.name];
            if (related === void 0) {
                continue;
            }
            if (Array.isArray(related)) {
                for (const r of related) {
                    r[iterator.relatedName] = this.entity;
                }
                continue;
            }
            related[relatedName] = this.entity;
            if (deleted) {
                this.pending.push(() => delete related[relatedName]);
            }
        }
    }
}
