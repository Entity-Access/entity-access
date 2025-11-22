import CIMap from "../common/CIMap.js";
import Logger, { ConsoleLogger } from "../common/Logger.js";
import { modelSymbol } from "../common/symbols/symbols.js";
import type QueryCompiler from "../compiler/QueryCompiler.js";
import ICheckConstraint from "../decorators/ICheckConstraint.js";
import { IColumn } from "../decorators/IColumn.js";
import type { IForeignKeyConstraint } from "../decorators/IForeignKeyConstraint.js";
import type { IIndex } from "../decorators/IIndex.js";
import type { BaseConnection, IQuery, IQueryResult } from "../drivers/base/BaseDriver.js";
import ExistingSchema from "../drivers/base/ExistingSchema.js";
import type EntityType from "../entity-query/EntityType.js";
import type EntityContext from "../model/EntityContext.js";
import type EntityQuery from "../model/EntityQuery.js";

export default abstract class Migrations {

    logger: Logger;

    protected schemaCache = new Map<string, ExistingSchema>();

    constructor(
        private context: EntityContext,
        protected connection: BaseConnection = context.connection,
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

            const schema = await this.getSchema(type);

            await this.migrateTable(context, type);

            // create constraints
            for (const iterator of type.checkConstraints) {
                if (schema.constraints.has(iterator.name)) {
                    continue;
                }
                const source = context.query(type.typeClass) as EntityQuery<any>;
                const { textQuery } = this.compiler.compileToSql(source, `(p) => ${iterator.filter}` as any);
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

                if(schema.foreignKeys.has(foreignKeyConstraint.name)) {
                    continue;
                }
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

    abstract dropIndex(indexName: string, tableName: string): Promise<void>;

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

        const schema = await this.getSchema(type);

        if (index.dropNames) {
            for (const dropName of index.dropNames) {
                if (schema.indexes.has(dropName)) {
                    await this.dropIndex(dropName, type.fullyQualifiedTableName);
                }
            }
        }

        if (schema.indexes.has(index.name)) {
            return;
        }


        for (const column of index.columns) {
            const c = type.getProperty(column.name);
            if (c.field) {
                column.name = c.field.columnName;
            }
        }

        if (index.include) {
            index.include = index.include.map((c) => type.getProperty(c).field.columnName);
        }

        if (index.filter && typeof index.filter !== "string") {
            // parse..
            const source = context.query(type.typeClass) as EntityQuery<any>;
            const { target , textQuery } = this.compiler.compileToSql(source, `(p) => ${index.filter}` as any);
            const r = new RegExp(source.selectStatement.sourceParameter.name + "\\.", "ig");
            index.filter = textQuery.join("").replace(r, "");
        }

        await this.migrateIndex(context, index, type);

    }

    async migrateTable(context: EntityContext, type: EntityType) {

        const schema = await this.getSchema(type);

        // create table if not exists...
        const nonKeyColumns = type.nonKeys;
        const keys = type.keys;

        if (!schema.tables.has(type.name)) {
            await this.createTable(type, keys);
        }

        await this.createColumns(type, nonKeyColumns);

    }

    async createColumns(type: EntityType, nonKeyColumns: IColumn[]) {
        const name = type.schema
            ? type.schema + "." + type.name
            : type.name;

        if (nonKeyColumns.length > 1) {
            nonKeyColumns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        const schema = await this.getSchema(type);

        const table = schema.tables.get(type.name);

        for (const iterator of nonKeyColumns) {
            if (table?.has(iterator.columnName)) {
                continue;
            }
            await this.createColumn(type, iterator);
        }

    }

    abstract createTable(type: EntityType, keys: IColumn[]);

    abstract createColumn(type: EntityType, column: IColumn);

    abstract migrateIndex(context: EntityContext, index: IIndex, type: EntityType);

    abstract migrateForeignKey(context: EntityContext, constraint: IForeignKeyConstraint);

    abstract migrateCheckConstraint(context: EntityContext, checkConstraint: ICheckConstraint, type: EntityType);

    public async getSchema(type: EntityType): Promise<ExistingSchema> {
        const schema = type.schema || "__ default + __ schema ";
        let s = this.schemaCache.get(schema);
        if (s) {
            return s;
        }
        // disable logging...
        const old = this.logger;
        this.logger = null;
        s = await this.getExistingSchema(type);
        this.logger = old;
        this.schemaCache.set(schema, s);
        return s;
    }

    protected abstract getExistingSchema(type: EntityType): Promise<ExistingSchema>;

    protected executeQuery(command: IQuery, signal?: AbortSignal): Promise<IQueryResult> {
        const text = typeof command === "string" ? command : command.text;
        this.logger?.log(text);
        return this.connection.executeQuery(command, signal);
    }

}
