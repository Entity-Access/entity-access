import Column from "../decorators/Column.js";
import Index from "../decorators/Index.js";
import Table from "../decorators/Table.js";
import Inject, { RegisterScoped, RegisterSingleton, ServiceProvider } from "../di/di.js";
import { BaseDriver } from "../drivers/base/BaseDriver.js";
import EntityContext from "../model/EntityContext.js";
import DateTime from "../types/DateTime.js";

@Table("Workflows")
@Index({
    name: "IX_Workflows_Group",
    columns: [{ name: (x) => x.group, descending: false }],
    filter: (x) => x.group !== null
})
@Index({
    name: "IX_Workflows_ETA",
    columns: [{ name: (x) => x.eta, descending: false }],
    filter: (x) => x.isWorkflow === true
})
export class WorkflowStorage {

    @Column({ dataType: "Char", length: 400, })
    public id: string;

    @Column({ dataType: "Boolean" })
    public isWorkflow: boolean;

    @Column({ dataType: "Char", nullable: true })
    public name: string;

    @Column({ dataType: "Char", length: 200, nullable: true })
    public group: string;

    @Column({ dataType: "Char"})
    public input: string;

    @Column({ dataType: "Char", nullable: true})
    public output: string;

    @Column({ dataType: "DateTime"})
    public eta: DateTime;

    @Column({ dataType: "DateTime"})
    public queued: DateTime;

    @Column({ dataType: "DateTime"})
    public updated: DateTime;

    @Column({ dataType: "Int", default: "0"})
    public priority: number;

    @Column({ dataType: "DateTime", nullable: true })
    public lockedTTL: DateTime;

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

    public workflows = this.model.register(WorkflowStorage);

    verifyFilters: boolean = false;

    raiseEvents: boolean = false;

}

@RegisterSingleton
export default class EternityStorage {

    constructor(@Inject
        private driver: BaseDriver) {

    }

    async get(id: string, input?) {
        await this.init();
        const db = new WorkflowContext(this.driver);
        const r = await db.workflows.where({ id }, (p) => (x) => x.id === p.id && x.isWorkflow === true).first();
        if (r !== null) {
            return {
                updated: r.updated,
                eta: r.eta,
                queued: r.queued,
                state: r.state,
                output: r.output,
                error: r.error
            };
        }
        return null;
    }

    async delete(id) {
        await this.init();
        const db = new WorkflowContext(this.driver);
        const children = await db.workflows.where({ id}, (p) => (x) => x.parentID === p.id)
            .limit(100)
            .toArray();
        for (const iterator of children) {
            db.workflows.delete(iterator);
        }
        await db.saveChanges();
        if (children.length > 0) {
            return;
        }

        const w = await db.workflows.where({ id}, (p) => (x) => x.id === p.id).first();
        if (!w) {
            return;
        }
        db.workflows.delete(w);
        await db.saveChanges();
    }

    async save(state: Partial<WorkflowStorage>) {
        await this.init();
        const db = new WorkflowContext(this.driver);
        await this.driver.runInTransaction(async () => {
            let w = await db.workflows.where(state, (p) => (x) => x.id === p.id).first();
            if (!w) {
                w = db.workflows.add(state);
            } else {
                for (const key in state) {
                    if (Object.prototype.hasOwnProperty.call(state, key)) {
                        const element = state[key];
                        w[key] = element;
                    }
                }
            }
            w.state ||= "queued";
            await db.saveChanges();
        });
    }

    async dequeue(signal?: AbortSignal) {
        const db = new WorkflowContext(this.driver);
        const now = DateTime.utcNow;
        const lockedTTL = now.addMinutes(1);
        return this.driver.runInTransaction(async () => {
            const list = await db.workflows
                .where({now}, (p) => (x) => x.eta <= p.now && (x.lockedTTL === null || x.lockedTTL <= p.now))
                .orderBy({}, (p) => (x) => x.eta)
                .thenBy({}, (p) => (x) => x.priority)
                .limit(20)
                .withSignal(signal)
                .toArray();
            for (const iterator of list) {
                iterator.lockedTTL = lockedTTL;
            }
            await db.saveChanges(signal);
            return list;
        });
    }

    private async init() {
        const init = async () => {
            const db = new WorkflowContext(this.driver);
            await this.driver.ensureDatabase();
            await db.driver.automaticMigrations().migrate(db);
        };
        const v = init();
        Object.defineProperty(this, "init", { value: () => v });
        return v;
    }

}
