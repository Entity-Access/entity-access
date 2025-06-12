/* eslint-disable no-console */
import ICheckConstraint from "../../decorators/ICheckConstraint.js";
import { IColumn } from "../../decorators/IColumn.js";
import { IForeignKeyConstraint } from "../../decorators/IForeignKeyConstraint.js";
import { IIndex } from "../../decorators/IIndex.js";
import { BaseConnection } from "../../drivers/base/BaseDriver.js";
import ExistingSchema from "../../drivers/base/ExistingSchema.js";
import { SqlServerLiteral } from "../../drivers/sql-server/SqlServerLiteral.js";
import EntityType from "../../entity-query/EntityType.js";
import type EntityContext from "../../model/EntityContext.js";
import SqlServerMigrations from "./SqlServerMigrations.js";

export default class SqlServerAutomaticMigrations extends SqlServerMigrations {

    async ensureVersionTable(context: EntityContext, table: string) {
        await context.connection.executeQuery(`IF OBJECT_ID(${ SqlServerLiteral.escapeLiteral(table)}) IS NULL BEGIN
            CREATE TABLE ${table}(
            [name] VARCHAR(200) NOT NULL,
            [version] VARCHAR(200) NOT NULL,
            [dateCreated] DATETIME2 DEFAULT GETUTCDATE(),
            constraint PK_MigrationTable_Version PRIMARY KEY ([name],[version])
        )
        END`);
    }


    async createIndexForForeignKeys(context: EntityContext, type: EntityType, fkColumns: IColumn[]) {
        for (const iterator of fkColumns) {
            const filter = iterator.nullable
                ? `${ iterator.quotedColumnName} IS NOT NULL`
                : "";
            const indexDef: IIndex = {
                name: `IX_${type.name}_${iterator.name}`,
                columns: [{ name: iterator.quotedColumnName, descending: iterator.indexOrder !== "ascending"}],
                filter
            };
            await this.migrateIndexInternal(context, indexDef, type);
        }
    }

    async createColumn(type: EntityType, iterator: IColumn) {

        const { quotedColumnName } = iterator;

        const name = type.schema
            ? type.schema + "." + type.name
            : type.name;

        let def = `ALTER TABLE ${name} ADD ${quotedColumnName} `;

        if (iterator.computed) {
            def += ` AS ${iterator.computed} ${iterator.stored ? "PERSISTED" : ""}`;
            await this.executeQuery(def + ";");
            return;
        }

        def += this.getColumnDefinition(iterator);
        if (iterator.nullable === true) {
            def += " NULL ";
        } else {
            def += " NOT NULL ";
        }
        if (iterator.computed) {
            def += ` AS ${iterator.computed} ${iterator.stored ? "PERSISTED" : ""}`;
        }
        if (typeof iterator.default === "string") {
            def += " DEFAULT " + iterator.default;
        }
        await this.executeQuery(def + ";");

    }

    async createTable(type: EntityType, keys: IColumn[]) {

        const name = type.schema
            ? type.schema + "." + type.name
            : type.name;

        if (keys.length > 1) {
            keys.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        const fields = [];

        for (const iterator of keys) {
            let def = iterator.quotedColumnName + " ";
            if (iterator.generated) {
                switch(iterator.generated) {
                    case "identity":
                        def += `${this.getColumnDefinition(iterator)} NOT NULL IDENTITY(1,1)`;
                        break;
                }
            } else {
                def += `${this.getColumnDefinition(iterator)} NOT NULL`;
            }
            // def += " NOT NULL\r\n\t";
            fields.push(def);
        }

        await this.executeQuery(`IF OBJECT_ID(${ SqlServerLiteral.escapeLiteral(name)}) IS NULL BEGIN
            CREATE TABLE ${name} (${fields.join(",")}
            , CONSTRAINT PK_${name} PRIMARY KEY(${keys.map((x) => x.quotedColumnName)})
            );
        END`);

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
        let query = `IF NOT EXISTS(SELECT * FROM sys.indexes WHERE name = '${indexName}' AND object_id = OBJECT_ID('${name}'))
        BEGIN   
            CREATE ${index.unique ? "UNIQUE" : ""} INDEX ${indexName} ON ${name} ( ${columns.join(", ")})`;
        if (index.filter) {
            query += ` WHERE (${index.filter})`;
        }
        query += `\nEND`;
        await this.executeQuery(query);
    }

    async constraintExists(context: EntityContext, name: string, schema: string, type: EntityType) {
        let text = `SELECT COUNT(*) as c1
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_NAME='${type.name}' 
        AND CONSTRAINT_NAME='${name}'`;

        if(schema) {
            text += ` and schema_name = ${schema}`;
        }

        const driver = context.connection;

        const r = await this.executeQuery(text);
        if (r.rows?.length === 0) {
            if (r.rows["c1"] > 0) {
                return true;
            }
        }

    }

    async migrateForeignKey(context: EntityContext, constraint: IForeignKeyConstraint) {
        const { type } = constraint;
        const name = type.schema
        ? type.schema + "." + type.name
        : type.name;

        if (await this.constraintExists(context, name, type.schema, type)) {
            return;
        }

        const driver = context.connection;

        // sql server does not allow self referencing FK
        // so we will not create it

        if (constraint.fkMap.some((f) => f.relatedKeyColumn.entityType === type)) {
            console.warn(`FK ${name} not set as Sql server does not allow recursive FK constraint.`);
            return;
        }

        let text = `ALTER TABLE ${name} ADD CONSTRAINT ${constraint.name} 
            foreign key (${constraint.fkMap.map((x) => x.fkColumn.quotedColumnName).join(",")})
            references ${constraint.fkMap[0].relatedKeyColumn.entityType.name}(
                ${constraint.fkMap.map((x) => x.relatedKeyColumn.quotedColumnName).join(",")}
            ) `;

        switch(constraint.onDelete) {
            case "cascade":
                text += " ON DELETE CASCADE";
                break;
            case "set-null":
                text += " ON DELETE SET NULL";
                break;
            case "set-default":
                text += " ON DELETE SET DEFAULT";
                break;
            case "restrict":
                text += " ON DELETE RESTRICT";
                break;
        }

        try {
            await this.executeQuery(text);
        } catch (error) {
            // we will simply ignore this
            console.warn(`Failed adding constraint ${constraint.name}`);
            console.warn(error);
        }
    }

    async migrateCheckConstraint(context: EntityContext, constraint: ICheckConstraint<any>, type: EntityType) {
        if (await this.constraintExists(context, constraint.name, type.schema, type)) {
            return;
        }

        const name = type.schema
        ? type.schema + "." + type.name
        : type.name;


        const driver = context.connection;

        const text = `ALTER TABLE ${name} ADD CONSTRAINT ${constraint.name} CHECK (${constraint.filter})`;

        try {
            await this.executeQuery(text);
        } catch (error) {
            // we will simply ignore this
            console.warn(`Failed adding constraint ${constraint.name}`);
            console.warn(error);
        }
    }

}
