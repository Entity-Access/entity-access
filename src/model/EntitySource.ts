import type EntityContext from "./EntityContext.js";
import type EntityType from "../entity-query/EntityType.js";
import type { IEntityQuery, IFilterExpression } from "./IFilterWithParameter.js";
import { contextSymbol, modelSymbol, traceSymbol } from "../common/symbols/symbols.js";
import { Expression, ExpressionAs, Identifier, InsertStatement, TableLiteral } from "../query/ast/Expressions.js";
import { DirectSaveType } from "../drivers/base/BaseDriver.js";
import IdentityService from "./identity/IdentityService.js";
import sleep from "../common/sleep.js";
import EntityAccessError from "../common/EntityAccessError.js";
import NameParser from "../decorators/parser/NameParser.js";
import EntityQuery from "./EntityQuery.js";

const removeUndefined = (obj) => {
    if (!obj) {
        return obj;
    }
    const r = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const element = obj[key];
            if (element === void 0) {
                continue;
            }
            r[key] = element;
        }
    }
    return r;
};

export type ISaveDirect<T> = {
    keys: Partial<T>,
    changes: Partial<T>,
    // select?: Partial<T>,
    mode: "selectOrInsert",
    updateAfterSelect?: never
} | {
    keys?: never,
    mode: "insert",
    changes: Partial<T>,
    updateAfterSelect?: never,
} | {
    keys?: Partial<T>,
    changes: Partial<T>,
    // select?: Partial<T>,
    mode: "update" | "upsert"
    /**
     * You can use map to update any fields you
     * retrieved from database to update
     * @param item loaded from database
     * @returns entity
     */
    updateAfterSelect?: (item:T) => T
} | {
    keys: Partial<T>,
    mode: "delete",
    updateAfterSelect?: never,
    changes?: never
};

export class EntityStatements<T = any> {


    constructor(
        private readonly model: EntityType,
        private readonly context: EntityContext) {
    }

    async select(entity: Partial<T>, keys: Partial<T>, loadChangeEntry = false): Promise<T> {
        const { context } = this;
        const q = context.driver.selectQueryWithKeys(this.model, entity, keys);
        const { logger } = context;
        logger?.debug(q.text);
        const r = await this.context.connection.executeQuery(q);
        if (!r.rows?.length) {
            return void 0;
        }
        const result = r.rows[0];
        if (result) {
            for (const key in result) {
                if (Object.prototype.hasOwnProperty.call(result, key)) {
                    const element = result[key];
                    entity[key] = element;
                }
            }
        }
        if (loadChangeEntry) {
            // lets set type...
            Object.setPrototypeOf(entity, this.model.typeClass.prototype);
            const ce = this.context.changeSet.getEntry(entity, entity);
            return ce.entity as T;
        }
        if (entity) {
            Object.setPrototypeOf(entity, this.model.typeClass.prototype);
        }
        return entity as T;
    }

    async insert(entity: Partial<T>, loadChangeEntry = false): Promise<T> {
        const { context } = this;
        const q = context.driver.insertQuery(this.model, entity);
        // console.log(q.text);
        const r = await context.connection.executeQuery(q);
        const { logger } = context;
        logger?.debug(q.text);
        const result = r.rows[0];
        if (result) {
            for (const key in result) {
                if (Object.prototype.hasOwnProperty.call(result, key)) {
                    const element = result[key];
                    entity[key] = element;
                }
            }
        }
        if (loadChangeEntry) {
            const ce = this.context.changeSet.getEntry(entity, entity);
            return ce.entity as any;
        }
        return entity as any;
    }

    async update(entity: Partial<T>, keys?: Partial<T>, loadChangeEntry = false): Promise<T> {
        const { context } = this;
        const { driver } = context;
        const q = driver.updateQuery(this.model, entity, void 0, keys);
        const { logger } = context;
        logger?.debug(q.text);
        // console.log(q.text);
        const r = await context.connection.executeQuery(q);
        if (!r.updated) {
            return void 0;
        }
        const result = r.rows[0];
        if (result) {
            for (const key in result) {
                if (Object.prototype.hasOwnProperty.call(result, key)) {
                    const element = result[key];
                    entity[key] = element;
                }
            }
        }
        if (loadChangeEntry) {
            const ce = this.context.changeSet.getEntry(entity);
            ce.apply(entity ?? {});
            return ce.entity as any;
        }
        return entity as any;
    }

    async selectOrInsert(entity: Partial<T>, keys?: Partial<T>, retry = 3): Promise<T> {
        const tx = this.context.connection.currentTransaction;
        let tid: string;
        if (tx) {
            tid = `txp_${Date.now()}`;
            await tx.save(tid);
        }

        try {
            const r = await this.select(entity, keys);
            if (r) {
                return r;
            }
            return await this.insert(entity);
        } catch (error) {
            retry --;
            if(retry > 0) {
                if (tid) {
                    await tx.rollbackTo(tid);
                }
                await sleep(300);
                return await this.selectOrInsert(entity, keys, retry);
            }
            throw error;
        }
    }

    async upsert(entity: Partial<T>, updateAfterSelect?: (x:T) => T, keys?: Partial<T>, retry = 3): Promise<T> {
        const tx = this.context.connection.currentTransaction;
        const logger = this.context.logger;
        let tid: string;
        if (tx) {
            tid = `txp_${Date.now()}`;
            await tx.save(tid);
        }

        try {
            if (updateAfterSelect) {
                let existing = await this.select(entity, keys) as T;
                if (existing) {
                    existing = updateAfterSelect(existing);
                    for (const key in existing) {
                        if (Object.prototype.hasOwnProperty.call(existing, key)) {
                            entity[key] = existing[key];
                        }
                    }
                }
            }
            const r = await this.update(entity, keys);
            if (r) {
                return r;
            }
            return await this.insert(entity);
        } catch (error) {
            logger?.debug(error);
            retry --;
            if(retry > 0) {
                if (tid) {
                    await tx.rollbackTo(tid);
                }
                await sleep(300);
                return await this.upsert(entity, updateAfterSelect, keys, retry);
            }
            throw error;
        }
    }

    async delete(entity: Partial<T>) {
        // check if we have keys...
        for(const key of this.model.keys) {
            const keyValue = entity[key.name];
            if (keyValue === void 0 || keyValue === null) {
                throw new EntityAccessError(`All keys must be present to delete the entity`);
            }
        }
        const q = this.context.driver.deleteQuery(this.model, entity);
        const r = await this.context.connection.executeQuery(q);
        return r.updated;
    }
}

export class EntitySource<T = any> {

    public statements:  EntityStatements<T>;

    get [modelSymbol]() {
        return this.model;
    }

    get[contextSymbol]() {
        return this.context;
    }

    private filter: Expression;


    constructor(
        private readonly model: EntityType,
        private readonly context: EntityContext
    ) {
        this.statements = new EntityStatements<T>(model, context);
    }

    public async saveDirect({
        keys,
        mode,
        changes,
        updateAfterSelect
    }: ISaveDirect<T> , retry = 2): Promise<T> {

        const { driver } = this.context;

        const returnFields = [] as Identifier[];

        const returnEntity = {} as any;
        Object.setPrototypeOf(returnEntity, this.model.typeClass.prototype);

        for (const iterator of this.model.columns) {
            returnFields.push(iterator.quotedColumnNameExp);
        }

        if (mode === "selectOrInsert" || mode === "upsert") {
            // check if it exits..
            if (!keys) {
                keys = {};
                for (const iterator of this.model.keys) {
                    keys[iterator.name] = changes[iterator.name];
                }
            }
            const exists = driver.createSelectWithKeysExpression(this.model, removeUndefined(keys), returnFields);
            const q = driver.compiler.compileExpression(null, exists);
            const er = await this.context.connection.executeQuery(q);
            if (er.rows?.[0]) {
                const fr = er.rows[0];
                for (const key in fr) {
                    if (Object.prototype.hasOwnProperty.call(fr, key)) {
                        const element = fr[key];
                        const name = this.model.getColumn(key).name;
                        returnEntity[name] = element;
                    }
                }
                if (mode !== "upsert") {
                    return returnEntity;
                }
                mode = "update";
                if (updateAfterSelect) {
                    const original = { ... returnEntity, ... changes };
                    const updates = updateAfterSelect(original);
                    for (const key in updates) {
                        if (Object.prototype.hasOwnProperty.call(updates, key)) {
                            const element = updates[key];
                            changes[key] = element;
                        }
                    }
                }
            }
        } else {
            retry--;
        }

        const expression = driver.createUpsertExpression(this.model, changes, mode, removeUndefined(keys), returnFields);
        if (!expression) {
            return changes as any;
        }
        const tx = this.context.connection.currentTransaction;
        let tid: string;
        if (tx) {
            tid = `txp_${Date.now()}`;
            await tx.save(tid);
        }
        try {
            const { text, values } = driver.compiler.compileExpression(null, expression);
            const r = await this.context.connection.executeQuery({ text, values });
            if(r.rows?.length) {
                const first = r.rows[0];
                for (const key in first) {
                    if (Object.prototype.hasOwnProperty.call(first, key)) {
                        const element = first[key];
                        const name = this.model.getColumn(key).name;
                        returnEntity[name] ??= element;
                    }
                }
            }
            return returnEntity;
        } catch (error) {
            if (retry > 0) {
                if (tid) {
                    await tx.rollbackTo(tid);
                }
                await sleep(300);
                return await this.saveDirect({ keys, mode, changes, updateAfterSelect } as any, retry -1);
            }
            throw error;
        }
    }

    public loadByKeys(keys: Partial<T>): Promise<T> {
        const identity = IdentityService.getIdentity(this.model, keys);
        const entry = this.context.changeSet.getByIdentity(identity);
        if (entry) {
            return entry.entity;
        }
        return (this.queryByKeys(keys) as any) .first() as Promise<T>;
    }

    public queryByKeys(keys: Partial<T>): IEntityQuery<T> {
        const filter = [];
        for (const iterator of this.model.keys) {
            filter.push(`x.${iterator.name} === p.${iterator.name}`);
        }

        return this.where(keys, `(p) => (x) => ${filter.join(" && ")}` as any) as any;
        // return q.first() as Promise<T>;
    }

    public navigation<TR>(keys: Partial<T>, property: (x: T) => TR): IEntityQuery<TR> {
        const name = typeof property === "string" ? property : NameParser.parseMember(property);
        const { relation } = this.model.getProperty(name);
        if (!relation) {
            throw new EntityAccessError(`No relation found`);
        }

        const { relatedEntity } = relation;

        if (relation.isInverseRelation) {

            // we will just try to load all inverse items...
            // this is tricky as we need to build inverse query...
            const { relatedRelation } = relation;
            const filter = [];
            for (const { fkColumn, relatedKeyColumn } of relatedRelation.fkMap) {
                filter.push(`x.${fkColumn.name} === p.${relatedKeyColumn.name}`);
            }

            const query = `(p) => (x) => ${filter.join(" && ")}` as any;
            // console.log(query);

            return this.context.model.register(relatedEntity.typeClass)
                .where(keys, query);

        }

        // need to setup inverse key check
        // const key = relatedEntity.keys[0];
        const ek = {} as any;
        // keys[key.name] = this.entity[relation.fkColumn.name];
        for (const { fkColumn, relatedKeyColumn } of relation.fkMap) {
            ek[relatedKeyColumn.name] = keys[fkColumn.name];
        }
        return this.context.model.register(relatedEntity.typeClass).queryByKeys(ek);
    }

    public add(item: Partial<T>): T {
        const p = Object.getPrototypeOf(item).constructor;
        if (!p || p === Object) {
            Object.setPrototypeOf(item, this.model.typeClass.prototype);
        }
        const entry = this.context.changeSet.getEntry(item);
        if (entry.status !== "detached" && entry.status !== "unchanged") {
            throw new Error("Entity is already attached to the context");
        }
        entry.status = "inserted";
        return entry.entity as T;
    }

    /**
     * Entity can only be deleted if all primary keys are present
     * @param item entity to delete
     */
    public delete(item: Partial<T>) {
        const p = Object.getPrototypeOf(item).constructor;
        if (!p || p === Object) {
            Object.setPrototypeOf(item, this.model.typeClass.prototype);
        }
        const entry = this.context.changeSet.getEntry(item);
        /** There is no need to check this, we will simply delete the entry */
        // if (entry.status === "modified" || entry.status === "deleted") {
        //     entry.status = "deleted";
        //     return entry.entity;
        // }
        // if (entry.status !== "detached" && entry.status !== "unchanged") {
        //     throw new Error("Entity is already attached to the context");
        // }
        entry.status = "deleted";
        return entry.entity;
    }

    public all(): IEntityQuery<T> {
        return this.asQuery();
    }

    public filtered(mode: "read" | "modify" = "read"): IEntityQuery<T> {
        const query = this.asQuery();
        const events = this.context.eventsFor(this.model.typeClass, true);
        return mode === "modify" ? events.modify(query) : events.filter(query);
    }

    public where<P>(...[parameter, fx]: IFilterExpression<P, T>) {
        return this.asQuery().where(parameter, fx);
    }

    public asQuery() {
        const { model, context } = this;
        const selectStatement = this.model.selectAllFields();
        selectStatement.model = model;
        return new EntityQuery<T>({
            context,
            traceQuery: context[traceSymbol],
            type: model,
            selectStatement
        }) as any as IEntityQuery<T>;

    }

    public toQuery() {
        const filter = this.filter;
        if(!filter) {
            return "";
        }
        return this.context.driver.compiler.compileExpression( this.asQuery() as any, filter);
    }
}
