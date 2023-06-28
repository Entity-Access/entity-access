import { IClassOf } from "../decorators/IClassOf.js";
import { BaseDriver, IDbConnectionString, IQueryTask } from "../drivers/base/BaseDriver.js";
import ChangeSet from "./ChangeSet.js";
import EntityModel from "./EntityModel.js";
import { Query } from "../query/Query.js";

export default class EntityContext {

    constructor(
        public driver: BaseDriver
    ) {

    }

    public readonly model = new EntityModel(this);
    public readonly changeSet = new ChangeSet(this);

    public async saveChanges() {

        const queries: IQueryTask[] = [];

        // build query...
        for (const iterator of this.changeSet.entries) {
            switch(iterator.status) {
                case "inserted":
                    queries.push(this.driver.createInsert(iterator.type, iterator.entity));
                    break;
            }
        }

        for (const iterator of queries) {
            const reader = await this.driver.executeReader(iterator.query);
            try {
                for await (const r of reader.next()) {
                    if (iterator.postExecution) {
                        await iterator.postExecution(r);
                    }
                }
            } finally {
                await reader.dispose();
            }
        }
    }

}
