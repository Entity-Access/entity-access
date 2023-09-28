import { modelSymbol } from "../common/symbols/symbols.js";
import type QueryCompiler from "../compiler/QueryCompiler.js";
import type { IForeignKeyConstraint } from "../decorators/IForeignKeyConstraint.js";
import type { IIndex } from "../decorators/IIndex.js";
import type EntityType from "../entity-query/EntityType.js";
import type EntityContext from "../model/EntityContext.js";
import type EntityQuery from "../model/EntityQuery.js";

export default abstract class Migrations {

    constructor(protected compiler: QueryCompiler) {}

    public async migrate(context: EntityContext) {
        const { model } = context;
        const postMigration = [] as (() => Promise<void>)[];
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
                    const { target , textQuery } = this.compiler.compileToSql(source, `(p) => ${column.default.toString().replace("()", "(x)")}` as any);
                    const r = new RegExp(source.selectStatement.sourceParameter.name + "\\.", "ig");
                    column.default = textQuery.join("").replace(r, "");
                }
            }

            await this.migrateTable(context, type);

            for (const index of type.indexes) {
                await this.migrateIndexInternal(context, index, type);
            }

            for (const { isInverseRelation , foreignKeyConstraint, relatedTypeClass } of type.relations) {
                if (isInverseRelation) {
                    continue;
                }
                if (!foreignKeyConstraint) {
                    continue;
                }

                const relatedEntity = model.register(relatedTypeClass)[modelSymbol] as EntityType;

                foreignKeyConstraint.type = type;
                foreignKeyConstraint.column = type.getProperty(foreignKeyConstraint.column.name).field;
                const refColumns = foreignKeyConstraint.refColumns;
                foreignKeyConstraint.refColumns = [];
                for (const iterator of refColumns) {
                    foreignKeyConstraint.refColumns.push(relatedEntity.getProperty(iterator.name).field);
                }

                postMigration.push(() => this.migrateForeignKey(context, foreignKeyConstraint));
            }
        }

        for (const iterator of postMigration) {
            await iterator();
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

    abstract migrateForeignKey(context: EntityContext, constraint: IForeignKeyConstraint);


}
