import { IColumn } from "../../decorators/IColumn.js";
import { IForeignKeyConstraint } from "../../decorators/IForeignKeyConstraint.js";
import { IIndex } from "../../decorators/IIndex.js";
import { BaseConnection, BaseDriver } from "../../drivers/base/BaseDriver.js";
import EntityType from "../../entity-query/EntityType.js";
import EntityContext from "../../model/EntityContext.js";
import Migrations from "../Migrations.js";
import PostgresMigrations from "./PostgresMigrations.js";

export default class PostgresAutomaticMigrations extends PostgresMigrations {

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

    async createColumns(driver: BaseConnection, type: EntityType, nonKeyColumns: IColumn[]) {

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

            if (iterator.generated === "computed") {
                def += ` GENERATED ALWAYS AS (${iterator.computed}) ${iterator.stored ? "STORED" : ""} \r\n\t`;
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
                        def += iterator.dataType === "BigInt" ? "bigint " : "int ";
                        def += " not null GENERATED BY DEFAULT AS IDENTITY\r\n\t";
                        break;
                    case "computed":
                        def += ` not null GENERATED ALWAYS AS (${iterator.computed}) ${iterator.stored ? "STORED" : ""} \r\n\t`;
                        break;
                }
            } else {
                def += this.getColumnDefinition(iterator);
                def += " not null \r\n\t";
            }
            fields.push(def);
        }

        await driver.executeQuery(`CREATE TABLE IF NOT EXISTS ${name} (${fields.join(",")}
        ,CONSTRAINT PK_${name} PRIMARY KEY (${keys.map((x) => x.columnName).join(",")})
        )`);

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
        let query = `CREATE ${index.unique ? "UNIQUE" : ""} INDEX IF NOT EXISTS ${indexName} ON ${name} ( ${columns.join(", ")})`;
        if (index.filter) {
            query += ` WHERE (${index.filter})`;
        }
        await driver.executeQuery(query);
    }

    async migrateForeignKey(context: EntityContext, constraint: IForeignKeyConstraint) {
        
    }


}
