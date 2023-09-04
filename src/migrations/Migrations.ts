import { modelSymbol } from "../common/symbols/symbols.js";
import type QueryCompiler from "../compiler/QueryCompiler.js";
import { IIndex } from "../decorators/IIndex.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import type EntityType from "../entity-query/EntityType.js";
import type EntityContext from "../model/EntityContext.js";
import type EntityQuery from "../model/EntityQuery.js";

export default abstract class Migrations {

    constructor(protected compiler: QueryCompiler) {}

    public async migrate(context: EntityContext) {
        const { model } = context;
        for (const s of model.sources.values()) {
            const type = s[modelSymbol] as EntityType;

            for (const column of type.columns) {
                if (column.computed && typeof column.computed !== "string") {
                    // parse..
                    const source = context.query(type.typeClass) as EntityQuery<any>;
                    const { target , textQuery } = this.compiler.compileToSql(source, `(p) => ${column.computed}` as any);
                    const r = new RegExp(source.selectStatement.sourceParameter.name + "\\.", "ig");
                    column.computed = textQuery.join("").replace(r, "");
                }
                if (column.default && typeof column.default !== "string") {
                    // parse..
                    const source = context.query(type.typeClass) as EntityQuery<any>;
                    const { target , textQuery } = this.compiler.compileToSql(source, `(p) => ${column.default}` as any);
                    const r = new RegExp(source.selectStatement.sourceParameter.name + "\\.", "ig");
                    column.default = textQuery.join("").replace(r, "");
                }
            }

            await this.migrateTable(context, type);

            for (const index of type.indexes) {
                await this.migrateIndexInternal(context, index, type);
            }
        }

    }

    async migrateIndexInternal(context: EntityContext, index: IIndex, type: EntityType) {
        // parse filter... pending...

        index = { ... index };

        for (const column of index.columns) {
            const c = type.getProperty(column.name);
            if (c.field) {
                column.name = c.field.columnName;
            }
        }

        if (index.filter && typeof index.filter !== "string") {
            // parse..
            const source = context.query(type.typeClass) as EntityQuery<any>;
            const { target , textQuery } = this.compiler.compileToSql(source, `(p) => ${index.filter}` as any);
            const r = new RegExp(source.selectStatement.sourceParameter.name + "\\.", "ig");
            index.filter = textQuery.join("").replace(r, "");
        }

        this.migrateIndex(context, index, type);

    }

    abstract migrateIndex(context: EntityContext, index: IIndex, type: EntityType);

    abstract migrateTable(context: EntityContext, type: EntityType): Promise<any>;


}
