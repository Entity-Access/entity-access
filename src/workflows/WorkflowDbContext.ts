import Column from "../decorators/Column.js";
import Index from "../decorators/Index.js";
import { RelateTo } from "../decorators/Relate.js";
import Table from "../decorators/Table.js";
import { RegisterScoped } from "../di/di.js";
import EntityContext from "../model/EntityContext.js";
import DateTime from "../types/DateTime.js";

export const loadedFromDb = Symbol("loadedFromDB");


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
@Index({
    name: "IX_Workflows_Throttle_Group",
    columns: [
        { name: (x) => x.throttleGroup, descending: false },
        { name: (x) => x.queued, descending: false }
    ],
    filter: (x) => x.isWorkflow === true && x.throttleGroup !== null
})
@Index({
    name: "IX_Workflows_Parent_ID",
    columns: [
        { name: (x) => x.parentID, descending: true }
    ],
    filter: (x) => x.parentID !== null
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

    @Column({
        dataType: "Char", length: 200, nullable: true
    })
    public throttleGroup: string;

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

    @Column({ dataType: "Char", length: 400 , nullable: true})
    @RelateTo(WorkflowItem, {
        property: (x) => x.parent,
        inverseProperty: (x) => x.children,
        foreignKeyConstraint: {
            name: "FC_Workflows_Parent_ID",
            cascade: "delete"
        }
    })
    public parentID: string;

    @Column({ dataType: "Char", length: 400 , nullable: true})
    public lastID: string;

    parent: WorkflowItem;
    children: WorkflowItem[];
}

@RegisterScoped
export class WorkflowDbContext extends EntityContext {

    public workflows = this.model.register(WorkflowItem);

    verifyFilters: boolean = false;

    raiseEvents: boolean = false;

}
