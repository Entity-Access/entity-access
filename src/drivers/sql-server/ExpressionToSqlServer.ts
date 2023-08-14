import ExpressionToSql from "../../query/ast/ExpressionToSql.js";
import { BooleanLiteral, InsertStatement, NumberLiteral, OrderByExpression, ReturnUpdated, SelectStatement, ValuesStatement } from "../../query/ast/Expressions.js";
import { ITextQuery, prepare } from "../../query/ast/IStringTransformer.js";

export default class ExpressionToSqlServer extends ExpressionToSql {

    visitReturnUpdated(e: ReturnUpdated): ITextQuery {
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

    visitInsertStatement(e: InsertStatement): ITextQuery {
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

    visitSelectStatement(e: SelectStatement): ITextQuery {

        this.prepareStatement(e);

        const orderBy = e.orderBy?.length > 0 ? prepare `\n\t\tORDER BY ${this.visitArray(e.orderBy)}` : "";
        const where = e.where ? prepare `\n\tWHERE ${this.visit(e.where)}` : "";

        const fields = this.visitArray(e.fields, ",\n\t\t");
        const joins = e.joins?.length > 0 ? prepare `\n\t\t${this.visitArray(e.joins, "\n")}` : [];

        const showTop = e.limit && !e.offset;
        const showFetch = e.limit && e.offset;

        if (e.limit && e.offset) {
            if (!e.orderBy?.length) {
                // lets set default order by... if not set...
                // as sql server needs something to order by...
                e.orderBy = [
                    OrderByExpression.create({  target:  NumberLiteral.one  })
                ];
            }
        }

        const topValue = Number(e.limit);
        const top = showTop ? prepare ` TOP (${() => topValue}) ` : "";

        let source: ITextQuery;
        let as: ITextQuery | "";
        if (e.source.type === "ValuesStatement") {
            const v = e.source as ValuesStatement;
            const rows = v.values.map((x) => prepare `(${this.visitArray(x)})`);
            source  = prepare `(VALUES ${rows}) as ${this.visit(e.sourceParameter)}(${this.visitArray(v.fields)})`;
            as = [];
        } else {
            source = this.visit(e.source);
            as = e.sourceParameter ? prepare ` AS ${this.visit(e.sourceParameter)}` : "";
        }

        // const as = e.as ? prepare ` AS ${this.visit(e.as)}` : "";
        const offset = showFetch ? prepare ` OFFSET ${Number(e.offset).toString()} ROWS ` : "";
        const next = showFetch ? prepare ` FETCH NEXT ${Number(e.limit).toString()} ROWS ONLY` : "";
        return prepare `SELECT ${top}
        ${fields}
        FROM ${source}${as}${joins}${where}${orderBy}${offset}${next}`;
    }

    visitValuesStatement(e: ValuesStatement): ITextQuery {
        const rows = [];
        for (const rowValues of e.values) {
            rows.push(prepare `(${ this.visitArray(rowValues) })`);
        }
        const fields = e.fields ? prepare ` as x11(${this.visitArray(e.fields)})` : "";
        return prepare `(VALUES ${rows}) ${fields}`;

    }

    visitBooleanLiteral({ value }: BooleanLiteral): ITextQuery {
        return value ? [ " 1 "] : [ " 0 "];
    }
}