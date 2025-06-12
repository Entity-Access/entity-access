import Logger, { ConsoleLogger } from "../common/Logger.js";
import { modelSymbol } from "../common/symbols/symbols.js";
import type QueryCompiler from "../compiler/QueryCompiler.js";
import ICheckConstraint from "../decorators/ICheckConstraint.js";
import { IColumn } from "../decorators/IColumn.js";
import type { IForeignKeyConstraint } from "../decorators/IForeignKeyConstraint.js";
import type { IIndex } from "../decorators/IIndex.js";
import type { BaseConnection, IQuery, IQueryResult } from "../drivers/base/BaseDriver.js";
import type EntityType from "../entity-query/EntityType.js";
import type EntityContext from "../model/EntityContext.js";
import type EntityQuery from "../model/EntityQuery.js";
import ExistingSchema from "./ExistingSchema.js";

export default abstract class Migrations {

    logger: Logger;

    constructor(
        private context: EntityContext,
        private connection: BaseConnection = context.connection,
        protected compiler: QueryCompiler = context.driver.compiler
    ) {

    }

    public async migrate({
        version,
        name = "default",
        historyTableName = "migrations",
        log = new ConsoleLogger(false),
        seed,
        createIndexForForeignKeys = true
    }: {
        version?: string,
        name?: string,
        historyTableName?: string,
        log?: Logger,
        seed?: (c: EntityContext) => Promise<any>,
        createIndexForForeignKeys?: boolean
    } = {} ) {
        const { context } = this;
        const { model } = context;
        this.logger = log ?? context.logger;
        const postMigration = [] as (() => Promise<void>)[];

        if (version) {
            // check if we have already stored this version...
            if(await this.hasVersion(context, name, version, historyTableName)) {
                // eslint-disable-next-line no-console
                console.warn(`Skipping migration, migration already exists for ${version}`);
                return false;
            }
        }

        for (const s of model.sources.values()) {
            const type = s[modelSymbol] as EntityType;

            if (type.doNotCreate) {
                continue;
            }

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

            // create constraints
            for (const iterator of type.checkConstraints) {
                const source = context.query(type.typeClass) as EntityQuery<any>;
                const { target , textQuery } = this.compiler.compileToSql(source, `(p) => ${iterator.filter}` as any);
                const r = new RegExp(source.selectStatement.sourceParameter.name + "\\.", "ig");
                iterator.filter = textQuery.join("").replace(r, "") as any;
                await this.migrateCheckConstraint(context, iterator, type);
            }

            for (const index of type.indexes) {
                await this.migrateIndexInternal(context, index, type);
            }

            if (createIndexForForeignKeys) {
                postMigration.push(() =>
                    this.createIndexForForeignKeys(context, type, type.nonKeys.filter((x) =>
                        x.fkRelation
                        && (!x.key || type.keys.indexOf(x) !== 0)
                        && !x.fkRelation?.doNotCreateIndex))
                );
            }

            for (const { isInverseRelation , foreignKeyConstraint, relatedTypeClass } of type.relations) {

                if (isInverseRelation) {
                    continue;
                }

                if (!foreignKeyConstraint) {
                    continue;
                }

                // const relatedEntity = model.register(relatedTypeClass)[modelSymbol] as EntityType;

                foreignKeyConstraint.type = type;
                // foreignKeyConstraint.fkMap
                // foreignKeyConstraint.column = type.getProperty(foreignKeyConstraint.column.name).field;
                // const refColumns = foreignKeyConstraint.refColumns;
                // foreignKeyConstraint.refColumns = [];
                // for (const iterator of refColumns) {
                //     foreignKeyConstraint.refColumns.push(relatedEntity.getProperty(iterator.name).field);
                // }

                postMigration.push(() => this.migrateForeignKey(context, foreignKeyConstraint));
            }
        }

        for (const iterator of postMigration) {
            await iterator();
        }

        if(version) {
            if (seed) {
                await seed(context);
            }
            await this.commitVersion(context, name, version, historyTableName);
        }
        return true;
    }

    async hasVersion(context: EntityContext, name: string, version: string, table: string) {
        const { quote, escapeLiteral } = this.compiler;

        table = quote(table);
        const versionColumn = quote("version");
        const nameColumn = quote("name");
        version = escapeLiteral(version);
        name = escapeLiteral(name);

        await this.ensureVersionTable(context, table);

        const r = await context.connection.executeQuery(`SELECT * FROM ${table} WHERE ${nameColumn} = ${name} AND ${versionColumn} = ${version}`);
        return r.rows?.length > 0;
    }

    abstract ensureVersionTable(context: EntityContext, table: string): Promise<any>;

    abstract createIndexForForeignKeys(context: EntityContext, type: EntityType, fkColumns: IColumn[]): Promise<void>;

    async commitVersion(context: EntityContext, name, version, table) {
        const { quote, escapeLiteral } = this.compiler;

        table = quote(table);
        const versionColumn = quote("version");
        const nameColumn = quote("name");
        version = escapeLiteral(version);
        name = escapeLiteral(name);

        await context.connection.executeQuery(`INSERT INTO ${table}(${nameColumn}, ${versionColumn}) VALUES (${name}, ${version})`);
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

    abstract migrateCheckConstraint(context: EntityContext, checkConstraint: ICheckConstraint, type: EntityType);

    protected executeQuery(command: IQuery, signal?: AbortSignal): Promise<IQueryResult> {
        const text = typeof command === "string" ? command : command.text;
        this.logger?.log(text);
        return this.connection.executeQuery(command, signal);
    }

}
