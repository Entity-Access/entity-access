import { IClassOf } from "../decorators/IClassOf.js";
import { BaseDriver, IDbConnectionString, IQueryTask } from "../drivers/base/BaseDriver.js";
import ChangeSet from "./ChangeSet.js";
import EntityModel from "./EntityModel.js";
import { Query } from "../query/Query.js";
import { Expression } from "../query/ast/Expressions.js";
import ExpressionToQueryVisitor from "../query/ast/ExpressionToQueryVisitor.js";

export default class EntityContext {

    constructor(
        public driver: BaseDriver
    ) {

    }

    public readonly model = new EntityModel(this);
    public readonly changeSet = new ChangeSet(this);

    public async saveChanges() {

        const expressions: Expression[] = [];

        // build query...
        for (const iterator of this.changeSet.entries) {
            switch(iterator.status) {
                case "inserted":
                    expressions.push(this.driver.createInsertExpression(iterator.type, iterator.entity));
                    break;
            }
        }

        for (const iterator of expressions) {
            const ev = new ExpressionToQueryVisitor();
            const text = ev.visit(iterator);
            const values = ev.variables;
            const reader = await this.driver.executeReader({ text, values });
            try {
                for await (const r of reader.next()) {
                    // wait...
                }
            } finally {
                await reader.dispose();
            }
        }
    }

}
