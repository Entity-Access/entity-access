import { IColumn } from "../../decorators/IColumn.js";
import Migrations from "../Migrations.js";

export default abstract class PostgresMigrations extends Migrations {

    protected getColumnDefinition(iterator: IColumn) {
        if (iterator.dataType === "Decimal") {
            if (iterator.precision && iterator.scale) {
                return `decimal (${iterator.precision}, ${iterator.scale})`;
            }
            return `decimal (18,2)`;
        }
        var type = this.getColumnType(iterator);
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
                return "timestamp";
            case "DateTimeOffset":
                return "timestamp with time zone";
            case "Double":
                return "float8"
            case "Float":
                return "real";
            case "Int":
                return "integer";
            case "Boolean":
                return "boolean";
            case "ByteArray":
                return "bytea";
            case "Decimal":
                return "decimal";
            case "JSON":
                return "json";
            case "JSONB":
                return "jsonb";
            case "UUID":
                return "uuid";
        }
        const a: never = iterator.dataType;
        throw new Error("Not Defined");
    }
}