import { BinaryExpression, Constant, DeleteStatement, Expression, ExpressionAs, ExpressionType, InsertStatement, QuotedLiteral, ReturnUpdated, SelectStatement, TableLiteral, UpdateStatement, ValuesStatement } from "./Expressions.js";
import Visitor from "./Visitor.js";

export default class ExpressionToQueryVisitor extends Visitor<string> {

    public variables: any[] = [];

    constructor(private quotedLiteral: ((i: string) => string) = JSON.stringify) {
        super();
    }

    visitValuesStatement(e: ValuesStatement): string {
        const rows = [];
        for (const rowValues of e.values) {
            const row = [];
            for (const rowValue of rowValues) {
                row.push(this.visit(rowValue));
            }
            rows.push(`(${row.join(",")})`);
        }
        return `VALUES ${rows.join(",")}`;
    }

    visitTableLiteral(e: TableLiteral): string {
        if (e.schema) {
            return `${this.visit(e.schema)}.${this.visit(e.name)}`;
        }
        return this.visit(e.name);
    }

    visitSelectStatement(e: SelectStatement): string {
        throw new Error("not implemented");
    }

    visitQuotedLiteral(e: QuotedLiteral): string {
        return this.quotedLiteral(e.literal);
    }

    visitExpressionAs(e: ExpressionAs): string {
        return `${this.visit(e.expression)} AS ${this.visit(e.alias)}`;
    }

    visitConstant(e: Constant): string {
        this.variables.push(e.value);
        return "$" + this.variables.length;
    }

    visitBinaryExpression(e: BinaryExpression): string {
        return `${this.visit(e.left)} ${e.operator} ${this.visit(e.right)}`;
    }

    visitReturnUpdated(e: ReturnUpdated): string {
        if (!e) {
            return "";
        }
        if (e.fields.length === 0) {
            return "";
        }
        const fields = e.fields.map((x) => this.visit(x)).join(",");
        return ` RETURNING ${fields}`;
    }

    visitInsertStatement(e: InsertStatement): string {
        const returnValues = this.visit(e.returnValues);
        if (e.values instanceof ValuesStatement) {

            const rows = [];
            for (const iterator of e.values.values) {
                const row = [];
                for (const v of iterator) {
                    row.push(this.visit(v));
                }
                if (row.length === 0) {
                    continue;
                }
                rows.push("(" + row.join(",") + ")");
            }

            if (rows.length === 0) {
                return `INSERT INTO ${this.visit(e.table)} ${returnValues}`;
            }

            return `INSERT INTO ${this.visit(e.table)} (${this.walkJoin(e.values.fields)}) VALUES ${rows.join(",")} ${returnValues}`;
        }
        return `INSERT INTO ${this.visit(e.table)} ${this.visit(e.values)} ${returnValues}`;

    }

    visitUpdateStatement(e: UpdateStatement): string {

        const table = this.visit(e.table);

        const where = this.visit(e.where);

        const set = e.set.map((x) => this.visit(x));

        return `UPDATE ${table} SET ${set.join(",")} WHERE ${where}`;
    }

    visitDeleteStatement(e: DeleteStatement): string {
        const table = this.visit(e.table);
        const where = this.visit(e.where);
        return `DELETE ${table} WHERE ${e.where}`;
    }

    walkJoin(e: Expression[], sep = ",\r\n\t"): string {
        return e.map((i) => this.visit(i)).join(sep);
    }

}
