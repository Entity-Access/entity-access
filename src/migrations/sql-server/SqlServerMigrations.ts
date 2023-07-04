import { IColumn } from "../../decorators/IColumn.js";
import Migrations from "../Migrations.js";

export default abstract class SqlServerMigrations extends Migrations {

    protected getColumnDefinition(iterator: IColumn) {
        if (iterator.dataType === "Decimal") {
            if (iterator.precision && iterator.scale) {
                return `decimal (${iterator.precision}, ${iterator.scale})`;
            }
            return `decimal (18,2)`;
        }
        const type = this.getColumnType(iterator);
        if (iterator.length) {
            return `${type} (${iterator.length})`;
        }
        return type;
    }

    protected getColumnType(iterator: IColumn) {
        switch(iterator.dataType) {
            case "BigInt":
                return "bigint";
            case "AsciiChar":
            case "Char":
                if (!iterator.length) {
                    return "text";
                }
                return "varchar";
            case "DateTime":
                return "DateTime2";
            case "DateTimeOffset":
                return "DateTimeOffset";
            case "Double":
                return "float";
            case "Float":
                return "real";
            case "Int":
                return "int";
            case "Boolean":
                return "bit";
            case "ByteArray":
                return "varbinary";
            case "Decimal":
                return "decimal";
            case "JSON":
                return "json";
            case "JSONB":
                return "jsonb";
            case "UUID":
                return "uniqueidentifier";
        }
        const a: never = iterator.dataType;
        throw new Error("Not Defined");
    }
}