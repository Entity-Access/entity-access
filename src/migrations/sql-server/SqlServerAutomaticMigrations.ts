import ICheckConstraint from "../../decorators/ICheckConstraint.js";
import { IColumn } from "../../decorators/IColumn.js";
import { IForeignKeyConstraint } from "../../decorators/IForeignKeyConstraint.js";
import { IIndex } from "../../decorators/IIndex.js";
import { BaseConnection, BaseDriver } from "../../drivers/base/BaseDriver.js";
import { SqlServerLiteral } from "../../drivers/sql-server/SqlServerLiteral.js";
import EntityType from "../../entity-query/EntityType.js";
import EntityContext from "../../model/EntityContext.js";
import Migrations from "../Migrations.js";
import SqlServerMigrations from "./SqlServerMigrations.js";

export default class SqlServerAutomaticMigrations extends SqlServerMigrations {

    async ensureVersionTable(context: EntityContext, table: string) {
        await context.connection.executeQuery(`IF OBJECT_ID(${ SqlServerLiteral.escapeLiteral(table)}) IS NULL BEGIN
            CREATE TABLE ${table}(
            [name] VARCHAR(200) NOT NULL,
            [version] VARCHAR(200) NOT NULL,
            [dateCreated] DATETIME2 DEFAULT GETUTCDATE(),
            constraint PK_MigrationTable_Version PRIMARY KEY ([name],[version])
        )
        END`);
    }

    async migrateTable(context: EntityContext, type: EntityType) {


        // create table if not exists...
        const nonKeyColumns = type.nonKeys;
        const keys = type.keys;

        const driver = context.connection;

        await this.createTable(driver, type, keys);

        await this.createColumns(driver, type, nonKeyColumns);

        await this.createIndexes(context, type, nonKeyColumns.filter((x) =>
            x.fkRelation
            && (!x.key || type.keys.indexOf(x) !== 0)
            && !x.fkRelation?.doNotCreateIndex));

    }

    async createIndexes(context: EntityContext, type: EntityType, fkColumns: IColumn[]) {
        for (const iterator of fkColumns) {
            const filter = iterator.nullable
                ? `${ iterator.columnName} IS NOT NULL`
                : "";
            const indexDef: IIndex = {
                name: `IX_${type.name}_${iterator.name}`,
                columns: [{ name: iterator.columnName, descending: iterator.indexOrder !== "ascending"}],
                filter
            };
            await this.migrateIndex(context, indexDef, type);
        }
    }

    async createColumns(driver: BaseConnection, type: EntityType, nonKeyColumns: IColumn[]) {

        const name = type.schema
        ? type.schema + "." + type.name
        : type.name;

        if (nonKeyColumns.length > 1) {
            nonKeyColumns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        for (const iterator of nonKeyColumns) {
            const columnName = iterator.columnName;
            let def = `IF COL_LENGTH(${ SqlServerLiteral.escapeLiteral(name)}, ${ SqlServerLiteral.escapeLiteral(columnName)}) IS NULL ALTER TABLE ${name} ADD ${columnName} `;

            if (iterator.computed) {
                def += ` AS ${iterator.computed} ${iterator.stored ? "PERSISTED" : ""}`;
                await driver.executeQuery(def + ";");
                continue;
            }

            def += this.getColumnDefinition(iterator);
            if (iterator.nullable === true) {
                def += " NULL ";
            } else {
                def += " NOT NULL ";
            }
            if (iterator.computed) {
                def += ` AS ${iterator.computed} ${iterator.stored ? "PERSISTED" : ""}`;
            }
            if (typeof iterator.default === "string") {
                def += " DEFAULT " + iterator.default;
            }
            await driver.executeQuery(def + ";");
        }

    }

    async createTable(driver: BaseConnection, type: EntityType, keys: IColumn[]) {

        const name = type.schema
            ? type.schema + "." + type.name
            : type.name;

        if (keys.length > 1) {
            keys.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        const fields = [];

        for (const iterator of keys) {
            let def = iterator.columnName + " ";
            if (iterator.generated) {
                switch(iterator.generated) {
                    case "identity":
                        def += `${this.getColumnDefinition(iterator)} NOT NULL IDENTITY(1,1)`;
                        break;
                }
            } else {
                def += `${this.getColumnDefinition(iterator)} NOT NULL`;
            }
            // def += " NOT NULL\r\n\t";
            fields.push(def);
        }

        await driver.executeQuery(`IF OBJECT_ID(${ SqlServerLiteral.escapeLiteral(name)}) IS NULL BEGIN
            CREATE TABLE ${name} (${fields.join(",")}
            , CONSTRAINT PK_${name} PRIMARY KEY(${keys.map((x) => x.columnName)})
            );
        END`);

    }

    async migrateIndex(context: EntityContext, index: IIndex, type: EntityType) {
        const driver = context.connection;
        const name = type.schema
            ? type.schema + "." + type.name
            : type.name;
        const indexName =  index.name;
        const columns = [];
        for (const column of index.columns) {
            const columnName = column.name;
            columns.push(`${columnName} ${column.descending ? "DESC" : "ASC"}`);
        }
        let query = `IF NOT EXISTS(SELECT * FROM sys.indexes WHERE name = '${indexName}' AND object_id = OBJECT_ID('${name}'))
        BEGIN   
            CREATE ${index.unique ? "UNIQUE" : ""} INDEX ${indexName} ON ${name} ( ${columns.join(", ")})`;
        if (index.filter) {
            query += ` WHERE (${index.filter})`;
        }
        query += `\nEND`;
        await driver.executeQuery(query);
    }

    async constraintExists(context: EntityContext, name: string, schema: string, type: EntityType) {
        let text = `SELECT COUNT(*) as c1
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_NAME='${type.name}' 
        AND CONSTRAINT_NAME='${name}'`;

        if(schema) {
            text += ` and schema_name = ${schema}`;
        }

        const driver = context.connection;

        const r = await driver.executeQuery(text);
        if (r.rows?.length === 0) {
            if (r.rows["c1"] > 0) {
                return true;
            }
        }

    }

    async migrateForeignKey(context: EntityContext, constraint: IForeignKeyConstraint) {
        const { type } = constraint;
        const name = type.schema
        ? type.schema + "." + type.name
        : type.name;

        if (await this.constraintExists(context, name, type.schema, type)) {
            return;
        }

        const driver = context.connection;

        let text = `ALTER TABLE ${name} ADD CONSTRAINT ${constraint.name} 
            foreign key (${constraint.fkMap.map((x) => x.fkColumn.columnName).join(",")})
            references ${constraint.fkMap[0].relatedKeyColumn.entityType.name}(
                ${constraint.fkMap.map((x) => x.relatedKeyColumn.columnName).join(",")}
            ) `;

        switch(constraint.onDelete) {
            case "cascade":
                text += " ON DELETE CASCADE";
                break;
            case "set-null":
                text += " ON DELETE SET NULL";
                break;
            case "set-default":
                text += " ON DELETE SET DEFAULT";
                break;
            case "restrict":
                text += " ON DELETE RESTRICT";
                break;
        }

        try {
            await driver.executeQuery(text);
        } catch (error) {
            // we will simply ignore this
            console.warn(`Failed adding constraint ${constraint.name}`);
            console.warn(error);
        }
    }

    async migrateCheckConstraint(context: EntityContext, constraint: ICheckConstraint<any>, type: EntityType) {
        if (await this.constraintExists(context, constraint.name, type.schema, type)) {
            return;
        }

        const name = type.schema
        ? type.schema + "." + type.name
        : type.name;


        const driver = context.connection;

        const text = `ALTER TABLE ${name} ADD CONSTRAINT ${constraint.name} CHECK (${constraint.filter})`;

        try {
            await driver.executeQuery(text);
        } catch (error) {
            // we will simply ignore this
            console.warn(`Failed adding constraint ${constraint.name}`);
            console.warn(error);
        }
    }

}
