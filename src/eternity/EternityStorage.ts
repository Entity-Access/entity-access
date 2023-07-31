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
class WorkflowStorage {

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

    @Column({ dataType: "Boolean"})
    public finished: boolean;

    @Column({ dataType: "Boolean"})
    public failed: boolean;

    @Column({ dataType: "Char", nullable: true})
    public error: string;

    @Column({ dataType: "Char", nullable: true})
    public extra: string;

    @Column({ dataType: "Char", length: 200 , nullable: true})
    public parentID: string;
}

@RegisterScoped
class WorkflowContext extends EntityContext {

    public workflows = this.model.register(WorkflowStorage);

    verifyFilters: boolean = false;

    raiseEvents: boolean = false;

}

@RegisterSingleton
export default class EternityStorage {

    @Inject
    private driver: BaseDriver;

    async get(id: string, input?) {
        await this.init();
        const scope = ServiceProvider.global.createScope();
        try {
            const db = scope.resolve(WorkflowContext);
            const r = await db.workflows.where({ id }, (p) => (x) => x.id === p.id && x.isWorkflow === true).first();
            if (r !== null) {
                return {
                    failed: r.failed,
                    finished: r.finished,
                    output: r.output,
                    error: r.error
                };
            }
        } finally {
            scope.dispose();
        }
        return null;
    }

    async save(state: Partial<WorkflowStorage>) {
        
    }

    async dequeue(signal?: AbortSignal) {
        await this.init();
    }

    private async init() {
        const init = async () => {
            const db = new WorkflowContext(this.driver);
            await db.driver.automaticMigrations().migrate(db);
        };
        const v = init();
        Object.defineProperty(this, "init", { value: v });
        return v;
    }

}
