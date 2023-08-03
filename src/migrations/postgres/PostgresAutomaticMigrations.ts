import { IColumn } from "../../decorators/IColumn.js";
import { IIndex } from "../../decorators/IIndex.js";
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

        await this.createIndexes(context, type, nonKeyColumns.filter((x) => x.fkRelation && !x.fkRelation?.dotNotCreateIndex));

    }

    async createIndexes(context: EntityContext, type: EntityType, fkColumns: IColumn[]) {
        for (const iterator of fkColumns) {
            const filter = iterator.nullable
                ? `${iterator.columnName} IS NOT NULL`
                : "";
            const indexDef: IIndex = {
                name: `IX_${type.name}_${iterator.columnName}`,
                columns: [{ name: iterator.columnName, descending: iterator.indexOrder !== "ascending"}],
                filter
            };
            await this.migrateIndex(context, indexDef, type);
        }
    }

    async createColumns(driver: BaseDriver, type: EntityType, nonKeyColumns: IColumn[]) {

        const name = type.schema
        ? type.schema + "." + type.name
        : type.name;

        if (nonKeyColumns.length > 1) {
            nonKeyColumns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        for (const iterator of nonKeyColumns) {
            const columnName = iterator.columnName;
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
            ? type.schema + "." + type.name
            : type.name;

        if (keys.length > 1) {
            keys.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        const fields = [];

        for (const iterator of keys) {
            let def = iterator.columnName + " ";
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

    async migrateIndex(context: EntityContext, index: IIndex, type: EntityType) {
        const driver = context.driver;
        const name = type.schema
        ? type.schema + "." + type.name
        : type.name;
        const indexName =  index.name;
        const columns = [];
        for (const column of index.columns) {
            const columnName = column.name;
            columns.push(`${columnName} ${column.descending ? "DESC" : "ASC"}`);
        }
        let query = `CREATE ${index.unique ? "UNIQUE" : ""} INDEX IF NOT EXISTS ${indexName} ON ${name} ( ${columns.join(", ")})`;
        if (index.filter) {
            query += ` WHERE (${index.filter})`;
        }
        await driver.executeQuery(query);
    }


}
