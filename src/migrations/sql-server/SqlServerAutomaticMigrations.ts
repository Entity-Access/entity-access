import { IColumn } from "../../decorators/IColumn.js";
import { IIndex } from "../../decorators/IIndex.js";
import { BaseConnection, BaseDriver } from "../../drivers/base/BaseDriver.js";
import { SqlServerLiteral } from "../../drivers/sql-server/SqlServerLiteral.js";
import EntityType from "../../entity-query/EntityType.js";
import EntityContext from "../../model/EntityContext.js";
import Migrations from "../Migrations.js";
import SqlServerMigrations from "./SqlServerMigrations.js";

export default class SqlServerAutomaticMigrations extends SqlServerMigrations {

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
            && !x.fkRelation?.dotNotCreateIndex));

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


}
