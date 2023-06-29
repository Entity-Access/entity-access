import { IColumn } from "../../decorators/Column.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
import EntityType from "../../entity-query/EntityType.js";
import EntityContext from "../../model/EntityContext.js";
import Migrations from "../Migrations.js";

export default class PostgresAutomaticMigrations extends Migrations {

    async migrateTable(context: EntityContext, type: EntityType) {
        

        // create table if not exists...
        const nonKeyColumns = type.nonKeys;
        const keys = type.keys;

        const driver = context.driver;

        await this.createTable(driver, type, keys);

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
                def += this.getColumnType(iterator);
            }
            def += "not null primary key\r\n\t";
        }

        await driver.executeNonQuery(`CREATE TABLE IF NOT EXISTS ${name} (${fields.join(",")})`);

    }
    
    getColumnType(iterator: IColumn) {
        switch(iterator.dataType) {
            case "AsciiChar":
            case "BigInt":
            case "Char":
            case "DateTime":
            case "Double":
                return "double"
            case "Float":
                return "float";
            case "Int":
                return "int";
            case "Boolean":
                return "bit";
        }
    }
    
}
