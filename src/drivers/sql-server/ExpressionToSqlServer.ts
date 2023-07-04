import ExpressionToSql from "../../query/ast/ExpressionToSql.js";
import { InsertStatement, ReturnUpdated, ValuesStatement } from "../../query/ast/Expressions.js";
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
}