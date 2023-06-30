import SchemaRegistry from "../decorators/SchemaRegistry.js";
import EntityType from "../entity-query/EntityType.js";
import type EntityContext from "../model/EntityContext.js";

export default abstract class Migrations {

    public async migrate(context: EntityContext) {
        for (const iterator of context.model.entities.keys()) {
            const type = SchemaRegistry.model(iterator);
            await this.migrateTable(context, type);
        }
    }

    abstract migrateTable(context: EntityContext, type: EntityType): Promise<any>;


}
