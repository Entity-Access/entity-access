import { randomUUID } from "crypto";
import Column from "../decorators/Column.js";
import Index from "../decorators/Index.js";
import Table from "../decorators/Table.js";
import Inject, { RegisterScoped, RegisterSingleton, ServiceProvider } from "../di/di.js";
import { BaseDriver } from "../drivers/base/BaseDriver.js";
import EntityContext from "../model/EntityContext.js";
import { BinaryExpression, CallExpression, Expression, NullExpression, NumberLiteral, UpdateStatement } from "../query/ast/Expressions.js";
import DateTime from "../types/DateTime.js";
import WorkflowClock from "./WorkflowClock.js";
import RawQuery from "../compiler/RawQuery.js";

@Table("Workflows")
@Index({
    name: "IX_Workflows_Group",
    columns: [{ name: (x) => x.groupName, descending: false }],
    filter: (x) => x.groupName !== null
})
@Index({
    name: "IX_Workflows_taskGroup_ETA",
    columns: [
        { name: (x) => x.eta, descending: false },
        { name: (x) => x.taskGroup, descending: false }
    ],
    filter: (x) => x.isWorkflow === true
})
export class WorkflowItem {

    @Column({ dataType: "Char", length: 400, key: true })
    public id: string;

    @Column({ dataType: "Boolean" })
    public isWorkflow: boolean;

    @Column({ dataType: "Char", nullable: true })
    public name: string;

    @Column({ dataType: "Char", length: 200, nullable: true })
    public groupName: string;

    @Column({ dataType: "Char"})
    public input: string;

    @Column({ dataType: "Char", nullable: true})
    public output: string;

    @Column({ })
    public eta: DateTime;

    @Column({ })
    public queued: DateTime;

    @Column({ })
    public updated: DateTime;

    @Column({
        dataType: "Char", length: 50,
        default: () => `default`
    })
    public taskGroup: string;

    @Column({ dataType: "Int", default: () => 0})
    public priority: number;

    @Column({ nullable: true })
    public lockedTTL: DateTime;

    @Column({ nullable: true })
    public lockToken: string;

    @Column({ dataType: "AsciiChar", length: 10})
    public state: "queued" | "failed" | "done";

    @Column({ dataType: "Char", nullable: true})
    public error: string;

    @Column({ dataType: "Char", nullable: true})
    public extra: string;

    @Column({ dataType: "Char", length: 200 , nullable: true})
    public parentID: string;

    @Column({ dataType: "Char", length: 200 , nullable: true})
    public lastID: string;
}

@RegisterScoped
class WorkflowContext extends EntityContext {

    public workflows = this.model.register(WorkflowItem);

    verifyFilters: boolean = false;

    raiseEvents: boolean = false;

}

@RegisterSingleton
export default class WorkflowStorage {

    private lockQuery: RawQuery;

    constructor(
        @Inject
        private driver: BaseDriver,
        @Inject
        public readonly clock: WorkflowClock
    ) {

    }

    async getWorkflow(id: string) {
        const db = new WorkflowContext(this.driver);
        const r = await db.workflows.where({ id }, (p) => (x) => x.id === p.id && x.isWorkflow === true).first();
        if (r !== null) {
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
            };
        }
        return null;
    }


    async getAny(id: string) {
        const db = new WorkflowContext(this.driver);
        const r = await db.workflows.where({ id }, (p) => (x) => x.id === p.id).first();
        if (r !== null) {
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
                taskGroup: r.taskGroup
            };
        }
        return null;
    }

    /**
     * Deletes given workflow and it's children
     * @param id id to delete
     * @returns true if all items are deleted
     */
    async delete(id) {
        const db = new WorkflowContext(this.driver);
        const children = await db.workflows.where({ id}, (p) => (x) => x.parentID === p.id)
            .limit(100)
            .toArray();
        for (const iterator of children) {
            if(!await this.delete(iterator.id)){
                return false;
            }
        }
        await db.saveChanges();
        if (children.length === 100) {
            return false;
        }

        const w = await db.workflows.where({ id}, (p) => (x) => x.id === p.id).first();
        if (!w) {
            return true;
        }
        db.workflows.delete(w);
        await db.saveChanges();
        return true;
    }

    async save(state: Partial<WorkflowItem>) {
        const db = new WorkflowContext(this.driver);
        const connection = db.connection;
        await connection.runInTransaction(async () => {
            let w = await db.workflows.where(state, (p) => (x) => x.id === p.id).first();
            if (!w) {
                w = db.workflows.add(state);
                w.taskGroup ||= "default";
            }

            for (const key in state) {
                if (Object.prototype.hasOwnProperty.call(state, key)) {
                    const element = state[key];
                    w[key] = element;
                }
            }

            w.state ||= "queued";
            w.updated ??= DateTime.utcNow;
            await db.saveChanges();
        });
    }

    async dequeue(taskGroup: string, signal?: AbortSignal) {
        const db = new WorkflowContext(this.driver);
        const now = this.clock.utcNow;

        if(!this.lockQuery) {

            const type = db.model.getEntityType(WorkflowItem);

            const px = Expression.parameter("x");
            const lockTokenField = type.getProperty("lockToken").field.columnName;
            const lockTTLField = type.getProperty("lockedTTL").field.columnName;

            const exp = UpdateStatement.create({
                table: type.fullyQualifiedName,
                set: [
                    Expression.assign(
                        Expression.identifier(lockTokenField),
                        Expression.member(px, "lockToken")
                    ),
                    Expression.assign(
                        Expression.identifier(lockTTLField),
                        CallExpression.create({
                            callee: Expression.member(Expression.member(Expression.identifier("Sql"), "date"), "addMinutes"),
                            arguments: [CallExpression.create({
                                callee: Expression.member(Expression.member(Expression.identifier("Sql"), "date"), "now")
                            }),
                            NumberLiteral.create({ value: 5 })
                        ]
                        })
                    )
                ],
                where: Expression.logicalAnd(Expression.equal(
                    Expression.identifier("id"),
                    Expression.member(px, "id")
                ), Expression.equal(
                    Expression.identifier(lockTokenField),
                    NullExpression.create({})
                ))
            });

            this.lockQuery = this.driver.compiler.compileToRawQuery(null, exp, px);
        }

        const q = this.lockQuery;

        const items = await db.workflows
            .where({now, taskGroup}, (p) => (x) => x.eta <= p.now
                && (x.lockedTTL === null || x.lockedTTL <= p.now)
                && x.lockToken === null
                && x.isWorkflow === true
                && x.taskGroup === p.taskGroup)
            .orderBy({}, (p) => (x) => x.eta)
            .thenBy({}, (p) => (x) => x.priority)
            .limit(20)
            .withSignal(signal)
            .toArray();
        const list: WorkflowItem[] = [];
        const uuid = randomUUID();
        for (const iterator of items) {
            // try to acquire lock...
            iterator.lockToken = uuid;
            const r = await q.invoke(db.connection, iterator);
            if (r.updated > 0) {
                list.push(iterator);
            }
        }
        return list;
    }

    async seed() {
        const db = new WorkflowContext(this.driver);
        await db.connection.ensureDatabase();
        await db.connection.automaticMigrations().migrate(db);
    }

}
