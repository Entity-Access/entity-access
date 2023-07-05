import ExpressionToSql from "../../query/ast/ExpressionToSql.js";
import { Identifier, InsertStatement, OrderByExpression, ReturnUpdated, SelectStatement, ValuesStatement } from "../../query/ast/Expressions.js";
import { ITextOrFunctionArray, prepare } from "../../query/ast/IStringTransformer.js";

export default class ExpressionToSqlServer extends ExpressionToSql {

    visitReturnUpdated(e: ReturnUpdated): ITextOrFunctionArray {
        if (!e) {
            return [];
        }
        if (e.fields.length === 0) {
            return [];
        }
        const fields = [];
        let i = 0;
        for (const iterator of e.fields) {
            if (i++) {
                fields.push(",");
            }
            fields.push(prepare `${e.changes}.${this.visit(iterator)}`);
        }
        return prepare ` OUTPUT ${fields}`;
    }

    visitInsertStatement(e: InsertStatement): ITextOrFunctionArray {
        const returnValues = this.visit(e.returnValues);
        if (e.values instanceof ValuesStatement) {

            const rows = [];
            for (const iterator of e.values.values) {
                const row = this.visitArray(iterator);
                if (row.length === 0) {
                    continue;
                }
                rows.push(prepare `(${ row })`);
            }

            if (rows.length === 0) {
                return prepare `INSERT INTO ${this.visit(e.table)} ${returnValues}`;
            }

            return prepare `INSERT INTO ${this.visit(e.table)} (${this.visitArray(e.values.fields)}) ${returnValues} VALUES ${rows}`;
        }
        return prepare `INSERT INTO ${this.visit(e.table)} ${returnValues} ${this.visit(e.values)}`;

    }

    visitSelectStatement(e: SelectStatement): ITextOrFunctionArray {
        const fields = this.visitArray(e.fields, ",\n\t\t");

        const showTop = e.limit && !e.offset;
        const showFetch = e.limit && e.offset;

        if (e.limit && e.offset) {
            if (!e.orderBy?.length) {
                // lets set default order by... if not set...
                // as sql server needs something to order by...
                e.orderBy = [
                    OrderByExpression.create({  target:  Identifier.create({ value: "1"})  })
                ];
            }
        }

        const topValue = Number(e.limit);
        const top = showTop ? prepare ` TOP (${() => topValue}) ` : "";

        const orderBy = e.orderBy?.length > 0 ? prepare `\n\t\tORDER BY ${this.visitArray(e.orderBy)}` : "";
        const source = this.visit(e.source);
        const where = e.where ? prepare `\n\tWHERE ${this.visit(e.where)}` : "";
        const as = e.as ? prepare ` AS ${this.visit(e.as)}` : "";
        const joins = e.joins?.length > 0 ? prepare `\n\t\t${this.visitArray(e.joins)}` : [];
        const offset = showFetch ? prepare ` OFFSET ${Number(e.offset).toString()} ROWS ` : "";
        const next = showFetch ? prepare ` FETCH NEXT ${Number(e.limit).toString()} ROWS ONLY` : "";
        return prepare `SELECT ${top}
        ${fields}
        FROM ${source}${as}${joins}${where}${orderBy}${offset}${next}`;
    }
}