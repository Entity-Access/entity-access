import { IColumn } from "../../decorators/IColumn.js";
import ExistingSchema from "../../drivers/base/ExistingSchema.js";
import EntityType from "../../entity-query/EntityType.js";
import Migrations from "../Migrations.js";

export default abstract class PostgresMigrations extends Migrations {

    async getExistingSchema(type: EntityType) {

        const schema = type.schema || "public";
        const values = [schema];

        let text = `
        select 
            column_name as "name",
            case data_type
                when 'bigint' then 'BigInt'
                when 'boolean' then 'Boolean'
                when 'timestamp' then 'DateTime'
                when 'timestamp with time zone' then 'DateTime'
                when 'timestamp without time zone' then 'DateTime'
                when 'integer' then 'Int'
                when 'real' then 'Double'
                when 'numeric' then 'Decimal'
                else 'Char' end as "dataType",
            case
                when is_nullable = 'YES' then true
                else false end as "nullable",
            character_maximum_length as "length",
            case
                when is_identity = 'YES' then 'identity'
                else null end as "identity",
            case
                when is_generated = 'YES' then '() => 1'
                else null end as "computed",
            table_name as "ownerName",
            'table' as "ownerType"
            from information_schema.columns
            where table_schema = $1`;

        let r = await this.executeQuery({ text, values});
        const columns =  r.rows;

        text = `
        SELECT
            tc.constraint_name as "name"
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
			WHERE
                tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = $1
        `;
        r = await this.executeQuery({ text, values});
        const foreignKeys = r.rows;

        text = `
        SELECT indexname as "name" FROM pg_indexes where schemaName=$1`;
        r = await this.executeQuery({ text, values });
        const indexes = r.rows;

        text = `
           SELECT con.conName as "name"
       FROM pg_catalog.pg_constraint con
            INNER JOIN pg_catalog.pg_class rel
                       ON rel.oid = con.conRelId
            INNER JOIN pg_catalog.pg_namespace nsp
                       ON nsp.oid = conNamespace
	   WHERE nsp.nspName = $1`;

        r = await this.executeQuery({ text, values });
        const constraints = r.rows;

        return new ExistingSchema(false, { columns, foreignKeys, indexes, constraints });
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
                return "float8";
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
            case "Geometry":
                return "geometry";
        }
        const a: never = iterator.dataType;
        throw new Error("Not Defined");
    }
}