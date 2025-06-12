import IColumnSchema from "../common/IColumnSchema.js";
import type { BaseConnection } from "../drivers/base/BaseDriver.js";

export default class ExistingSchema {


    public static async getSchema(connection: BaseConnection, schema: string, table: string, caseInsensitive = false) {
        let s = this.cache.get(schema);
        if (!s) {
            const columns = await connection.getColumnSchema(schema);
            s = new ExistingSchema(columns, caseInsensitive);
            this.cache.set(schema, s);
        }
        if (caseInsensitive) {
            table = table.toLowerCase();
        }
        return s.tables.get(table) ?? [];
    }

    private static cache = new Map<string, ExistingSchema>();

    public tables = new Map<string,IColumnSchema[]>();

    constructor(columns: IColumnSchema[], caseInsensitive = false) {
        for (const c of columns) {
            let tableName = c.ownerName;
            if (caseInsensitive) {
                tableName = tableName.toLowerCase();
            }
            let table = this.tables.get(tableName);
            if (!table) {
                table = [];
                this.tables.set(tableName, table);
            }
            table.push(c);
        }
    }

}