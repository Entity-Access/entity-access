import { BaseDriver } from "../drivers/base/BaseDriver.js";
import ChangeSet from "./changes/ChangeSet.js";
import EntityModel from "./EntityModel.js";
import { Expression } from "../query/ast/Expressions.js";
import { IClassOf } from "../decorators/IClassOf.js";
import VerificationSession from "./verification/VerificationSession.js";
import EntityType from "../entity-query/EntityType.js";
import EntityEvents from "./events/EntityEvents.js";
import ChangeEntry from "./changes/ChangeEntry.js";

const isChanging = Symbol("isChanging");

export default class EntityContext {

    public readonly model = new EntityModel(this);
    public readonly changeSet = new ChangeSet(this);

    public raiseEvents = true;

    public verifyFilters = false;

    public get isChanging() {
        return this[isChanging];
    }

    constructor(
        public driver: BaseDriver
    ) {

    }

    query<T>(type: IClassOf<T>) {
        return this.model.register(type).asQuery();
    }

    public async saveChanges() {

        if (this[isChanging]) {
            return;
        }
        try {
            this[isChanging] = true;
            return await this.saveChangesInternal();
        } finally {
            this[isChanging] = false;
        }
    }

    async saveChangesInternal() {

        this.changeSet.detectChanges();

        const verificationSession = new VerificationSession(this);

        const pending = [] as { status: ChangeEntry["status"], change: ChangeEntry  }[];

        for (const iterator of this.changeSet.entries) {

            const events = this.getEventsFor(iterator.type);
            switch(iterator.status) {
                case "inserted":
                    await events.beforeInsert(iterator.entity, iterator);
                    if (this.verifyFilters) {
                        verificationSession.queueVerification(iterator);
                    }
                    pending.push({ status: iterator.status, change: iterator });
                    continue;
                case "deleted":
                    await events.beforeDelete(iterator.entity, iterator);
                    if (this.verifyFilters) {
                        verificationSession.queueVerification(iterator);
                    }
                    pending.push({ status: iterator.status, change: iterator });
                    continue;
                case "modified":
                    await events.beforeUpdate(iterator.entity, iterator);
                    if (this.verifyFilters) {
                        verificationSession.queueVerification(iterator);
                    }
                    pending.push({ status: iterator.status, change: iterator });
                    continue;
            }
        }

        if (this.verifyFilters) {
            await verificationSession.verifyAsync();
        }

        await this.driver.runInTransaction(async () => {
            for (const iterator of this.changeSet.entries) {
                switch(iterator.status) {
                    case "inserted":
                        const insert  = this.driver.createInsertExpression(iterator.type, iterator.entity);
                        const r = await this.executeExpression(insert);
                        iterator.apply(r);
                        break;
                    case "modified":
                        if (iterator.modified.size > 0) {
                            const update = this.driver.createUpdateExpression(iterator);
                            await this.executeExpression(update);
                        }
                        iterator.apply({});
                        break;
                    case "deleted":
                        const deleteQuery = this.driver.createDeleteExpression(iterator.type, iterator.entity);
                        if (deleteQuery) {
                            await this.executeExpression(deleteQuery);
                        }
                        iterator.apply({});
                        break;
                }
            }
        });

        if (pending.length > 0) {

            for (const { status, change, change: { entity} } of pending) {

                const events = this.getEventsFor(change.type);

                switch(status) {
                    case "inserted":
                        await events.afterInsert(entity, entity);
                        continue;
                    case "deleted":
                        await events.afterDelete(entity, entity);
                        continue;
                    case "modified":
                        await events.afterUpdate(entity, entity);
                        continue;
                }
            }
        }

    }

    private async executeExpression(expression: Expression) {
        const { text, values } = this.driver.compiler.compileExpression(expression);
        const r = await this.driver.executeQuery({ text, values });
        return r.rows?.[0];
    }

    private getEventsFor(type: EntityType): EntityEvents<any> {
        throw new Error("Method not implemented.");
    }
}
