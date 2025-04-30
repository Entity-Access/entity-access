/* eslint-disable no-console */
import { randomUUID } from "crypto";
import Inject, { RegisterSingleton } from "../di/di.js";
import { BaseDriver } from "../drivers/base/BaseDriver.js";
import { CallExpression, Expression, NullExpression, NumberLiteral, UpdateStatement } from "../query/ast/Expressions.js";
import DateTime from "../types/DateTime.js";
import WorkflowClock from "./WorkflowClock.js";
import RawQuery from "../compiler/RawQuery.js";
import { loadedFromDb, WorkflowDbContext, WorkflowItem } from "./WorkflowDbContext.js";
import WorkflowTask from "./WorkflowTask.js";
import Sql from "../sql/Sql.js";


@RegisterSingleton
export default class WorkflowStorage {

    // private lockQuery: RawQuery;

    constructor(
        @Inject
        private driver: BaseDriver,
        @Inject
        public readonly clock: WorkflowClock
    ) {

    }

    async getNextEta(throttle: { group: string, maxPerSecond: number }) {

        const db = new WorkflowDbContext(this.driver);
        const last = await db.workflows.where(throttle, (p) => (x) => x.throttleGroup === p.group
            && x.isWorkflow === true)
            .orderByDescending(void 0, (p) => (x) => x.queued)
            .first();

        if (last) {
            if (throttle.maxPerSecond <= 0) {
                throttle.maxPerSecond = 1;
            }
            return DateTime.from(last.queued).addSeconds(1 / throttle.maxPerSecond);
        }

        return DateTime.now;
    }

    async getWorkflow(id: string) {
        const db = new WorkflowDbContext(this.driver);
        const r = await db.workflows.statements.select({}, { id, isWorkflow: true });
        if (r) {
            return {
                id,
                parentID: r.parentID,
                lockTTL: r.lockedTTL,
                lockToken: r.lockToken,
                updated: r.updated,
                eta: r.eta,
                queued: r.queued,
                state: r.state,
                output: r.output,
                error: r.error,
                lastID: r.lastID,
                taskGroup: r.taskGroup,
                extra: r.extra,
                [loadedFromDb]: true,
            };
        }
        return null;
    }


    async getAny(id: string) {
        const db = new WorkflowDbContext(this.driver);
        const r = await db.workflows.statements.select({}, { id });
        if (r) {
            return {
                id,
                parentID: r.parentID,
                lockTTL: r.lockedTTL,
                lockToken: r.lockToken,
                updated: r.updated,
                eta: r.eta,
                queued: r.queued,
                state: r.state,
                output: r.output,
                error: r.error,
                lastID: r.lastID,
                [loadedFromDb]: true
            };
        }
        return null;
    }

    async extra(id, text?) {
        const db = new WorkflowDbContext(this.driver);
        if (text) {
            // save..
            await db.workflows.statements.update({ extra: text }, { id });
            // await db.workflows.where({ id }, (p) => (x) => x.id === p.id)
            //     .update({ text}, (p) => (x) => ({ extra: p.text }));
            return text;
        }
        const item = await db.workflows.where({ id }, (p) => (x) => x.id === p.id)
            .select(void 0, (p) => (x) => ({ extra: x.extra}) ).first();
        return item?.extra;
}

    /**
     * Deletes given workflow and it's children
     * @param id id to delete
     * @returns true if all items are deleted
     */
    async delete(id) {
        const db = new WorkflowDbContext(this.driver);
        await db.workflows.where({ id}, (p) => (x) => x.parentID === p.id)
            .limit(100)
            .delete({ id }, (p) => (x) => x.parentID === p.id);
        if (await db.workflows.where({ id}, (p) => (x) => x.parentID === p.id).some()) {
            return;
        }
        await db.workflows.asQuery()
            .delete({ id}, (p) => (x) => x.id === p.id);
        return true;
    }

    async save(state: Partial<WorkflowItem>) {
        const db = new WorkflowDbContext(this.driver);
        state.state ||= "queued";
        state.updated ??= DateTime.now;
        state.taskGroup ||= "default";
        // await db.saveChanges();
        if(state[loadedFromDb]) {
            await db.workflows.statements.update(state);
        } else {
            await db.workflows.statements.upsert(state, void 0, { id: state.id });
        }
    }

    async dequeue(taskGroup: string, signal?: AbortSignal) {
        const db = new WorkflowDbContext(this.driver);
        const now = this.clock.utcNow;

        // if(!this.lockQuery) {

        //     const type = db.model.getEntityType(WorkflowItem);

        //     const px = Expression.parameter("x");
        //     const lockTokenField = type.getProperty("lockToken").field.columnName;
        //     const lockTTLField = type.getProperty("lockedTTL").field.columnName;

        //     const exp = UpdateStatement.create({
        //         table: type.fullyQualifiedName,
        //         set: [
        //             Expression.assign(
        //                 Expression.identifier(lockTokenField),
        //                 Expression.member(px, "lockToken")
        //             ),
        //             Expression.assign(
        //                 Expression.identifier(lockTTLField),
        //                 CallExpression.create({
        //                     callee: Expression.identifier("Sql.date.addSeconds"),
        //                     arguments: [CallExpression.create({
        //                         callee: Expression.identifier("Sql.date.now")
        //                     }),
        //                     NumberLiteral.create({ value: 15 })
        //                 ]
        //                 })
        //             )
        //         ],
        //         where: Expression.logicalAnd(Expression.equal(
        //             Expression.identifier("id"),
        //             Expression.member(px, "id")
        //         ), Expression.logicalOr(
        //             Expression.equal(
        //                 Expression.identifier(lockTTLField),
        //                 NullExpression.create({})
        //             ),
        //             Expression.lessOrEqual(
        //                 Expression.identifier(lockTTLField),
        //                 CallExpression.create({
        //                     callee: Expression.identifier("Sql.date.now")
        //                 })
        //             )
        //         ))
        //     });

        //     this.lockQuery = this.driver.compiler.compileToRawQuery(null, exp, px);
        // }

        // const q = this.lockQuery;

        const uuid = randomUUID();

        const items = await db.workflows
            .where({now, taskGroup}, (p) => (x) => x.eta <= p.now
                && ( x.lockedTTL === null
                    || x.lockedTTL <= p.now
                )
                && x.isWorkflow === true
                && x.taskGroup === p.taskGroup)
            .orderBy({}, (p) => (x) => x.eta)
            .thenBy({}, (p) => (x) => x.priority)
            .limit(20)
            .withSignal(signal)
            .updateSelect({ uuid}, (p) => (x) => ({
                lockedTTL: Sql.date.addSeconds(Sql.date.now(), 15),
                lockToken: p.uuid
            }));
        const all = items.map((x) => new WorkflowTask(x, db));
        if (all.length) {
            console.log(`Executing ${all.length} items for group ${taskGroup}`);
        }
        return all;
    }

    async seed(version?) {
        const db = new WorkflowDbContext(this.driver);
        await db.connection.ensureDatabase();
        await db.connection.automaticMigrations().migrate(db, { version, name: "workflows" });
    }

}
