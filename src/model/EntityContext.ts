import { BaseDriver } from "../drivers/base/BaseDriver.js";
import ChangeSet from "./ChangeSet.js";
import EntityModel from "./EntityModel.js";
import { Expression } from "../query/ast/Expressions.js";
import QueryCompiler from "../compiler/QueryCompiler.js";

export default class EntityContext {

    public readonly model = new EntityModel(this);
    public readonly changeSet = new ChangeSet(this);

    constructor(
        public driver: BaseDriver
    ) {

    }

    public async saveChanges() {

        this.changeSet.detectChanges();

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
                }
            }
        });
    }

    private async executeExpression(expression: Expression) {
        const { text, values } = this.driver.compiler.compileExpression(expression);
        const r = await this.driver.executeQuery({ text, values });
        return r.rows[0];
    }

}
