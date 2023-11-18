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

const isChanging = Symbol("isChanging");

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

    eventsFor<T>(type: IClassOf<T>, fail = true): EntityEvents<T>{
        const eventsClass = this.events?.for(type, fail);
        if (!eventsClass) {
            if (fail) {
                EntityAccessError.throw(`No rules defined for ${type.name}`);
            }
            return null;
        }
        const events = ServiceProvider.create(this, eventsClass);
        Object.defineProperty(events, "verify", {
            get:() => {
                return this.verifyFilters;
            }
        });
        return events;
    }

    query<T>(type: IClassOf<T>) {
        const query = this.model.register(type).asQuery();
        return query;
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

    public async saveChangesWithoutEvents(signal?: AbortSignal) {
        const raiseEvents = this.raiseEvents;
        const verifyFilters = this.verifyFilters;
        try {
            this.raiseEvents = false;
            this.verifyFilters = false;
            return await this.saveChanges(signal);
        } finally {
            this.verifyFilters = verifyFilters;
            this.raiseEvents = raiseEvents;
        }
    }

    public async saveChanges(signal?: AbortSignal) {

        if (this[isChanging]) {
            if (!this.raiseEvents) {
                this.queuePostSaveTask(() => this.saveChangesInternalWithoutEvents(signal));
                return 0;
            }
            this.queuePostSaveTask(() => this.saveChanges(signal));
            return 0;
        }

        return this.connection.runInTransaction(async () => {
            try {

                if(!this.raiseEvents) {
                    return await this.saveChangesInternalWithoutEvents(signal);
                }

                this[isChanging] = true;
                const r = await this.saveChangesInternal(signal);
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
                return r;
            } finally {
                this[isChanging] = false;
            }
        });
    }

    public queuePostSaveTask(task: () => any, order = Number.MAX_SAFE_INTEGER) {
        this.postSaveChangesQueue ??= [];
        this.postSaveChangesQueue.push({ task, order });
    }

    private async saveChangesInternal(signal?: AbortSignal) {

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

        await this.saveChangesInternalWithoutEvents(signal);

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

    private async saveChangesInternalWithoutEvents(signal: AbortSignal) {
        const copy = Array.from(this.changeSet.getChanges()) as ChangeEntry[];
        for (const iterator of copy) {
            switch (iterator.status) {
                case "inserted":
                    const insert = this.driver.createInsertExpression(iterator.type, iterator.entity);
                    const r = await this.executeExpression(insert, signal);
                    iterator.apply(r);
                    break;
                case "modified":
                    // this will update the modified map
                    iterator.detect();
                    if (iterator.modified.size > 0) {
                        const update = this.driver.createUpdateExpression(iterator);
                        await this.executeExpression(update, signal);
                        iterator.apply(update);
                    }
                    break;
                case "deleted":
                    const deleteQuery = this.driver.createDeleteExpression(iterator.type, iterator.entity);
                    if (deleteQuery) {
                        await this.executeExpression(deleteQuery, signal);
                    }
                    iterator.apply({});
                    break;
            }
        }
    }

    private async executeExpression(expression: Expression, signal: AbortSignal) {
        const { text, values } = this.driver.compiler.compileExpression(null, expression);
        const r = await this.connection.executeQuery({ text, values }, signal);
        return r.rows?.[0];
    }

}
