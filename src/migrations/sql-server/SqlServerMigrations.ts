import CIMap from "../../common/CIMap.js";
import { IColumn } from "../../decorators/IColumn.js";
import ExistingSchema from "../../drivers/base/ExistingSchema.js";
import EntityType from "../../entity-query/EntityType.js";
import Migrations from "../Migrations.js";

export default abstract class SqlServerMigrations extends Migrations {

    protected schemaCache = new CIMap<ExistingSchema>();

    async getExistingSchema(type: EntityType) {

        const schema = type.schema || "dbo";

        const text = `
                        SELECT
                COLUMN_NAME as [name],
                CASE DATA_TYPE
                    WHEN 'bit' THEN 'Boolean'
                    WHEN 'int' Then 'Int'
                    WHEN 'bigint' THEN 'BigInt'
                    WHEN 'date' then 'DateTime'
                    WHEN 'datetime' then 'DateTime'
                    WHEN 'datetime2' then 'DateTime'
                    WHEN 'real' then 'Float'
                    WHEN 'double' then 'Double'
                    WHEN 'decimal' then 'Decimal'
                    WHEN 'identity' then 'UUID'
                    WHEN 'varbinary' then 'ByteArray'
                    WHEN 'geometry' then 'Geometry'
                    ELSE 'Char'
                END as [dataType],
                CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as [nullable],
                CHARACTER_MAXIMUM_LENGTH as [length],
                CASE 
                    WHEN COLUMN_DEFAULT = 'getutcdate()' then '() => Sql.date.now()'
                    WHEN COLUMN_DEFAULT = '(getutcdate())' then '() => Sql.date.now()'
                    WHEN COLUMN_DEFAULT = '(newid())' then '() => Sql.crypto.randomUUID()'
                    WHEN (COLUMN_DEFAULT = '(0)' OR COLUMN_DEFAULT = '((0))')
                        AND DATA_TYPE = 'bit' THEN '() => false'
                    WHEN (COLUMN_DEFAULT = '(1)' OR COLUMN_DEFAULT = '((1))')
                        AND DATA_TYPE = 'bit' THEN '() => true'
                    WHEN COLUMN_DEFAULT is NULL THEN ''
                    ELSE '() => ' + COLUMN_DEFAULT
                END as [default],
                ColumnProperty(OBJECT_ID(TABLE_SCHEMA+'.'+TABLE_NAME),COLUMN_NAME,'IsComputed') as [computed],
                TABLE_NAME as [ownerName],
                'table' as [ownerType]
                FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = $1
        `;
        const r = await this.executeQuery({ text, values: [schema] });
        const columns = r.rows;
        return new ExistingSchema(true, { columns });
    }

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
                if (!iterator.length) {
                    return "varchar(max)";
                }
                return "varchar";
            case "Char":
                if (!iterator.length) {
                    return "nvarchar(max)";
                }
                return "nvarchar";
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
                return "UniqueIdentifier";
            case "Geometry":
                return "geometry";
        }
        const a: never = iterator.dataType;
        throw new Error("Not Defined");
    }
}