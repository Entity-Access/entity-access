import { BaseConnection, BaseDriver } from "../drivers/base/BaseDriver.js";
import ChangeSet from "./changes/ChangeSet.js";
import EntityModel from "./EntityModel.js";
import { Expression } from "../query/ast/Expressions.js";
import { IClassOf } from "../decorators/IClassOf.js";
import VerificationSession from "./verification/VerificationSession.js";
import EntityType from "../entity-query/EntityType.js";
import EntityEvents from "./events/EntityEvents.js";
import ChangeEntry from "./changes/ChangeEntry.js";
import ContextEvents from "./events/ContextEvents.js";
import Inject, { ServiceProvider } from "../di/di.js";
import EntityAccessError from "../common/EntityAccessError.js";
import Logger from "../common/Logger.js";
import { FilteredExpression } from "./events/FilteredExpression.js";
import { traceSymbol } from "../common/symbols/symbols.js";

const isChanging = Symbol("isChanging");

const empty = {};

export interface ISaveOptions {
    trace?: (text: string) => void;
    signal?: AbortSignal;
};

export default class EntityContext {

    public readonly model = new EntityModel(this);
    public readonly changeSet = new ChangeSet(this);

    public raiseEvents: boolean;

    public verifyFilters = false;

    public get isChanging() {
        return this[isChanging];
    }

    public get connection() {
        return this._connection ??= this.driver.newConnection();
    }

    private postSaveChangesQueue: { task: () => any, order: number }[];

    private _connection: BaseConnection;

    private readonly eventsCache  = new Map();

    constructor(
        @Inject
        public driver: BaseDriver,
        @Inject
        private events?: ContextEvents,
        @Inject
        public readonly logger?: Logger
    ) {
        this.raiseEvents = !!events;
    }

    eventsFor<T>(type: IClassOf<T>, fail = true): EntityEvents<T> {
        let ee = this.eventsCache.get(type);
        if (ee === void 0) {
            const eventsClass = this.events?.for(type, fail);
            if (!eventsClass) {
                if (fail) {
                    EntityAccessError.throw(`No rules defined for ${type.name}`, 422);
                }
                this.eventsCache.set(type, null);
                return null;
            }
            ee = ServiceProvider.create(this, eventsClass);
            Object.defineProperty(ee, "verify", {
                get:() => {
                    return this.verifyFilters;
                }
            });
            this.eventsCache.set(type, ee);
            return ee;
        }
        return ee;
    }

    query<T>(type: IClassOf<T>) {
        const query = this.model.register(type).asQuery();
        return query;
    }

    expand<T, TR>(type: IClassOf<T>, keys: Partial<T>, property: (x: T) => TR) {
        return this.model.register(type).navigation(keys, property);
    }

    filteredQuery<T>(type: IClassOf<T>, mode: "read" | "include" | "modify" | "delete" | "none", fail = false, parentType?, key?) {
        const query = this.model.register(type).asQuery();
        if (!this.verifyFilters || mode === "none") {
            return FilteredExpression.markAsFiltered(query);
        }
        const events = this.eventsFor(type, fail);
        if (events) {
            switch(mode) {
                case "read":
                    return FilteredExpression.markAsFiltered(events.filter(query) ?? query);
                case "include":
                    return FilteredExpression.markAsFiltered(events.includeFilter(query, parentType, key) ?? query);
                case "modify":
                    return FilteredExpression.markAsFiltered(events.modify(query) ?? query);
                case "delete":
                    return FilteredExpression.markAsFiltered(events.delete(query) ?? query);
            }
        }
        return FilteredExpression.markAsFiltered(query);
    }

    public async saveChangesWithoutEvents(options?: ISaveOptions) {
        const raiseEvents = this.raiseEvents;
        const verifyFilters = this.verifyFilters;
        try {
            this.raiseEvents = false;
            this.verifyFilters = false;
            return await this.saveChanges(options);
        } finally {
            this.verifyFilters = verifyFilters;
            this.raiseEvents = raiseEvents;
        }
    }

    public async saveChanges(options?: ISaveOptions) {

        if (this[isChanging]) {
            if (!this.raiseEvents) {
                this.queuePostSaveTask(() => this.saveChangesInternalWithoutEvents(options));
                return 0;
            }
            this.queuePostSaveTask(() => this.saveChanges(options));
            return 0;
        }

        await using tx = await this.connection.createTransaction();
        const oldTraceSymbol = this[traceSymbol];
        this[traceSymbol] = options?.trace;
        try {

            if(!this.raiseEvents) {
                const rx = await this.saveChangesInternalWithoutEvents(options);
                await tx.commit();
                return rx;
            }

            this[isChanging] = true;
            const r = await this.saveChangesInternal(options);
            const postSaveChanges = this.postSaveChangesQueue;
            this.postSaveChangesQueue = void 0;
            this[isChanging] = false;
            if (postSaveChanges?.length) {
                postSaveChanges.sort((a, b) => a.order - b.order);
                for (const { task } of postSaveChanges) {
                    const p = task();
                    if (p?.then) {
                        await p;
                    }
                }
            }
            await tx.commit();
            return r;
        } finally {
            this[isChanging] = false;
            this[traceSymbol] = oldTraceSymbol;
        }
    }

    public queuePostSaveTask(task: () => any, order = Number.MAX_SAFE_INTEGER) {
        this.postSaveChangesQueue ??= [];
        this.postSaveChangesQueue.push({ task, order });
    }

    private async saveChangesInternal(options: ISaveOptions) {

        const verificationSession = new VerificationSession(this);

        const pending = [] as { status: ChangeEntry["status"], change: ChangeEntry , events: EntityEvents<any>  }[];

        for (const iterator of this.changeSet.getChanges()) {

            switch(iterator.status) {
                case "unchanged":
                case "detached":
                case "attached":
                    continue;
            }

            const events = this.eventsFor(iterator.type.typeClass);
            switch(iterator.status) {
                case "inserted":
                    await events.beforeInsert(iterator.entity, iterator);
                    if (this.verifyFilters) {
                        verificationSession.queueVerification(iterator, events);
                    }
                    pending.push({ status: iterator.status, change: iterator, events });
                    iterator.setupInverseProperties();
                    continue;
                case "modified":
                    await events.beforeUpdate(iterator.entity, iterator);
                    if (this.verifyFilters) {
                        verificationSession.queueVerification(iterator, events);
                    }
                    pending.push({ status: iterator.status, change: iterator, events });
                    iterator.setupInverseProperties();
                    continue;
                case "deleted":
                    await events.beforeDelete(iterator.entity, iterator);
                    if (this.verifyFilters) {
                        verificationSession.queueVerification(iterator, events);
                    }
                    pending.push({ status: iterator.status, change: iterator, events });
                    continue;
            }
        }

        if (this.verifyFilters) {
            await verificationSession.verifyAsync();
        }

        await this.saveChangesInternalWithoutEvents(options);

        if (pending.length > 0) {

            for (const { status, change, change: { entity}, events } of pending) {
                switch(status) {
                    case "inserted":
                        await events.afterInsert(entity, change);
                        continue;
                    case "modified":
                        await events.afterUpdate(entity, change);
                        change.clearUpdated();
                        continue;
                    case "deleted":
                        await events.afterDelete(entity, change);
                        continue;
                }
            }
        }

    }

    private async saveChangesInternalWithoutEvents(options?: ISaveOptions) {
        const signal = options?.signal;
        const copy = Array.from(this.changeSet.getChanges()) as ChangeEntry[];
        const { connection } = this;
        for (const iterator of copy) {
            switch (iterator.status) {
                case "inserted":
                    // const insert = iterator.type.getInsertStatement();
                    // we are choosing not to create one complicated SQL as generation
                    // of insert requires checking if value is supplied or not, if not, we have to choose
                    // default value
                    // const insert = this.driver.createInsertExpression(iterator.type, iterator.entity);
                    // const r = await this.executeExpression(insert, options);
                    const insert = this.driver.insertQuery(iterator.type, iterator.entity);
                    const r = await connection.executeQuery(insert, signal);
                    iterator.apply(r.rows[0]);
                    break;
                case "modified":
                    // this will update the modified map
                    iterator.detect();
                    if (iterator.modified.size > 0) {
                        // const update = this.driver.createUpdateExpression(iterator);
                        const update = this.driver.updateQuery(iterator.type, iterator.entity, iterator.modified);
                        const r1 = await connection.executeQuery(update, signal);
                        iterator.apply(r1.rows?.[0] ?? {});
                    }
                    break;
                case "deleted":
                    const deleteQuery = this.driver.deleteQuery(iterator.type, iterator.entity);
                    if (deleteQuery) {
                        await connection.executeQuery(deleteQuery, signal);
                    }
                    iterator.apply({});
                    break;
            }
        }
    }

    private async executeExpression(expression: Expression, { signal , trace }: ISaveOptions = empty) {
        const { text, values } = this.driver.compiler.compileExpression(null, expression);
        if (trace) {
            trace(text);
        }
        const r = await this.connection.executeQuery({ text, values }, signal);
        return r.rows?.[0];
    }

}
