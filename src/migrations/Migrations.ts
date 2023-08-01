import type QueryCompiler from "../compiler/QueryCompiler.js";
import { IIndex } from "../decorators/IIndex.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import type EntityType from "../entity-query/EntityType.js";
import type EntityContext from "../model/EntityContext.js";
import type EntityQuery from "../model/EntityQuery.js";

export default abstract class Migrations {

    constructor(protected compiler: QueryCompiler) {}

    public async migrate(context: EntityContext) {
        for (const iterator of context.model.entities.keys()) {
            const type = SchemaRegistry.model(iterator);
            await this.migrateTable(context, type);

            for (const index of type.indexes) {
                await this.migrateIndexInternal(context, index, type);
            }
        }

    }

    async migrateIndexInternal(context: EntityContext, index: IIndex, type: EntityType) {
        // parse filter... pending...

        index = { ... index };

        if (index.filter && typeof index.filter !== "string") {
            // parse..
            const source = context.query(type.typeClass) as EntityQuery<any>;
            const { target , textQuery } = this.compiler.compileToSql(source, `(p) => ${index.filter}` as any);
            index.filter = textQuery.join("").split( this.compiler.quotedLiteral(source.selectStatement.sourceParameter.name) + ".").join("");
        }

        this.migrateIndex(context, index, type);

    }

    abstract migrateIndex(context: EntityContext, index: IIndex, type: EntityType);

    abstract migrateTable(context: EntityContext, type: EntityType): Promise<any>;


}
