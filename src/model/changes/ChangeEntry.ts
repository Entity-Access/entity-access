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

export default class ChangeEntry implements IChanges {

    type: EntityType;
    entity: any;
    order: number;
    original: any;
    status: "detached" | "attached" | "inserted" | "modified" | "deleted" | "unchanged";

    modified: Map<IColumn, IChange>;

    changeSet: ChangeSet;

    private pending: (() => void)[];

    constructor(p: IChanges, changeSet: ChangeSet) {
        Object.setPrototypeOf(p, ChangeEntry.prototype);
        const ce = p as ChangeEntry;
        ce.changeSet = changeSet;
        ce.pending = [];
        ce.modified = new Map();
        return ce;
    }

    public detect() {

        if (this.status === "deleted") {
            return;
        }

        const { type: { columns }, entity, original } = this;

        if (original === void 0) {
            this.status = "inserted";
            this.detectDependencies();
            return;
        }

        this.detectDependencies();

        for (const iterator of columns) {
            const oldValue = original[iterator.columnName];
            const newValue = entity[iterator.name];
            if (entity[iterator.name] !== original[iterator.columnName]) {
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

        this.status = "unchanged";
        this.modified.clear();
    }

    detectDependencies() {
        const { type: { relations }, entity } = this;
        // for parent relations.. check if related key is set or not...
        for (const iterator of relations) {
            if (iterator.isCollection) {
                continue;
            }

            // get related entry..
            const related = entity[iterator.name];
            if (!related) {
                continue;
            }

            // if related has key defined.. set it...
            const rKey = iterator.relatedEntity.keys[0];

            const relatedChanges = this.changeSet.getEntry(related);

            const keyValue = related[rKey.name];
            if (keyValue === void 0) {
                this.order++;
                const fk = iterator;
                relatedChanges.pending.push(() => {
                    this.entity[fk.fkColumn.name] = related[rKey.name];
                });
                this.modified.set(iterator, { column: iterator.fkColumn, oldValue: void 0, newValue: void 0});
                continue;
            }

            this.entity[iterator.fkColumn.name] = related[rKey.name];
        }
    }

    setupInverseProperties() {
        const deleted = this.status === "deleted";
        for (const iterator of this.type.relations) {
            if (!iterator.isCollection) {
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
