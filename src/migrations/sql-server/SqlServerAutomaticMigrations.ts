import { IColumn } from "../../decorators/IColumn.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
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

        const driver = context.driver;

        await this.createTable(driver, type, keys);

        await this.createColumns(driver, type, nonKeyColumns);

        await this.createIndexes(driver, type, nonKeyColumns.filter((x) => x.fkRelation && !x.fkRelation?.dotNotCreateIndex));

    }

    async createIndexes(driver: BaseDriver, type: EntityType, fkColumns: IColumn[]) {

        const name = type.schema
        ? SqlServerLiteral.quotedLiteral(type.schema) + "." + SqlServerLiteral.quotedLiteral(type.name)
        : SqlServerLiteral.quotedLiteral(type.name);

        for (const iterator of fkColumns) {
            const indexName =  SqlServerLiteral.quotedLiteral(`IX_${type.name}_${iterator.columnName}`);
            const columnName = SqlServerLiteral.quotedLiteral(iterator.columnName);
            let query = `CREATE INDEX ${indexName} ON ${name} ( ${columnName})`;
            if (iterator.nullable !== true) {
                query += ` WHERE (${columnName} is not null)`;
            }
            await driver.executeNonQuery(query);
        }
    }

    async createColumns(driver: BaseDriver, type: EntityType, nonKeyColumns: IColumn[]) {

        const name = type.schema
        ? SqlServerLiteral.quotedLiteral(type.schema) + "." + SqlServerLiteral.quotedLiteral(type.name)
        : SqlServerLiteral.quotedLiteral(type.name);

        if (nonKeyColumns.length > 1) {
            nonKeyColumns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        for (const iterator of nonKeyColumns) {
            const columnName = SqlServerLiteral.quotedLiteral(iterator.columnName);
            let def = `IF COL_LENGTH(${ SqlServerLiteral.escapeLiteral(name)}, ${ SqlServerLiteral.escapeLiteral(columnName)}) IS NULL ALTER TABLE ${name} ADD ${columnName} `;
            def += this.getColumnDefinition(iterator);
            if (iterator.nullable === true) {
                def += " NULL ";
            } else {
                def += " NOT NULL ";
            }
            if (typeof iterator.default === "string") {
                def += " DEFAULT " + iterator.default;
            }
            await driver.executeNonQuery(def + ";");
        }

    }

    async createTable(driver: BaseDriver, type: EntityType, keys: IColumn[]) {

        const name = type.schema
            ? SqlServerLiteral.quotedLiteral(type.schema) + "." + SqlServerLiteral.quotedLiteral(type.name)
            : SqlServerLiteral.quotedLiteral(type.name);

        if (keys.length > 1) {
            keys.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        const fields = [];

        for (const iterator of keys) {
            let def = SqlServerLiteral.quotedLiteral(iterator.columnName) + " ";
            if (iterator.autoGenerate) {
                def += this.getColumnDefinition(iterator) + " IDENTITY(1,1)";
            } else {
                def += this.getColumnDefinition(iterator);
            }
            def += " NOT NULL primary key\r\n\t";
            fields.push(def);
        }

        await driver.executeNonQuery(`IF OBJECT_ID(${ SqlServerLiteral.escapeLiteral(name)}) IS NULL BEGIN
            CREATE TABLE ${name} (${fields.join(",")});
        END`);

    }


}
