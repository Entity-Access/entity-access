import { IColumn } from "../../decorators/IColumn.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
import EntityType from "../../entity-query/EntityType.js";
import EntityContext from "../../model/EntityContext.js";
import Migrations from "../Migrations.js";
import PostgresMigrations from "./PostgresMigrations.js";

export default class PostgresAutomaticMigrations extends PostgresMigrations {

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
        ? JSON.stringify(type.schema) + "." + JSON.stringify(type.name)
        : JSON.stringify(type.name);

        for (const iterator of fkColumns) {
            const indexName =  JSON.stringify(`IX_${type.name}_${iterator.columnName}`);
            const columnName = JSON.stringify(iterator.columnName);
            let query = `CREATE INDEX ${indexName} ON ${name} ( ${columnName})`;
            if (iterator.nullable !== true) {
                query += ` WHERE (${columnName} is not null)`;
            }
            await driver.executeQuery(query);
        }
    }

    async createColumns(driver: BaseDriver, type: EntityType, nonKeyColumns: IColumn[]) {

        const name = type.schema
        ? JSON.stringify(type.schema) + "." + JSON.stringify(type.name)
        : JSON.stringify(type.name);

        if (nonKeyColumns.length > 1) {
            nonKeyColumns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        for (const iterator of nonKeyColumns) {
            const columnName = JSON.stringify(iterator.columnName);
            let def = `ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS ${columnName} `;
            def += this.getColumnDefinition(iterator);
            if (iterator.nullable !== true) {
                def += " NOT NULL ";
            }
            if (typeof iterator.default === "string") {
                def += " DEFAULT " + iterator.default;
            }
            await driver.executeQuery(def + ";");
        }

    }

    async createTable(driver: BaseDriver, type: EntityType, keys: IColumn[]) {

        const name = type.schema
            ? JSON.stringify(type.schema) + "." + JSON.stringify(type.name)
            : JSON.stringify(type.name);

        if (keys.length > 1) {
            keys.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        const fields = [];

        for (const iterator of keys) {
            let def = JSON.stringify(iterator.columnName) + " ";
            if (iterator.autoGenerate) {
                def += iterator.dataType === "BigInt" ? "bigserial " : "serial ";
            } else {
                def += this.getColumnDefinition(iterator);
            }
            def += " not null primary key\r\n\t";
            fields.push(def);
        }

        await driver.executeQuery(`CREATE TABLE IF NOT EXISTS ${name} (${fields.join(",")})`);

    }


}
