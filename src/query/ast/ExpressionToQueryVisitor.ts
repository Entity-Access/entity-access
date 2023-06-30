import { BinaryExpression, Constant, DeleteStatement, Expression, ExpressionAs, ExpressionType, InsertStatement, JoinExpression, OrderByExpression, QuotedLiteral, ReturnUpdated, SelectStatement, TableLiteral, UpdateStatement, ValuesStatement } from "./Expressions.js";
import Visitor from "./Visitor.js";

export default class ExpressionToQueryVisitor extends Visitor<string> {

    public variables: any[] = [];

    constructor(private quotedLiteral: ((i: string) => string) = JSON.stringify) {
        super();
    }

    visitValuesStatement(e: ValuesStatement): string {
        const rows = [];
        for (const rowValues of e.values) {
            const row = this.visitArray(rowValues);
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
        const fields = this.visitArray(e.fields).join(",");
        const joins = e.joins?.length > 0 ?  this.visitArray(e.joins) : "";
        const orderBy = e.orderBy?.length > 0 ? ` ORDER BY ${this.visitArray(e.orderBy)}` : "";
        const source = this.visit(e.source);
        const where = e.where ? ` WHERE ${this.visit(e.where)}` : "";
        return `SELECT ${fields} FROM ${source} ${joins} ${where} ${orderBy}`;
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
        const fields = this.visitArray(e.fields).join(",");
        return ` RETURNING ${fields}`;
    }

    visitInsertStatement(e: InsertStatement): string {
        const returnValues = this.visit(e.returnValues);
        if (e.values instanceof ValuesStatement) {

            const rows = [];
            for (const iterator of e.values.values) {
                const row = this.visitArray(iterator);
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

        const set = this.visitArray(e.set);

        return `UPDATE ${table} SET ${set.join(",")} WHERE ${where}`;
    }

    visitDeleteStatement(e: DeleteStatement): string {
        const table = this.visit(e.table);
        const where = this.visit(e.where);
        return `DELETE ${table} WHERE ${where}`;
    }

    visitJoinExpression(e: JoinExpression): string {
        if(!e) {
            return "";
        }
        const table = this.visit(e.source);
        const where = this.visit(e.where);
        return ` ${e.joinType} JOIN ${table} ON ${where}`;
    }

    visitOrderByExpression(e: OrderByExpression): string {
        if(!e) {
            return "";
        }
        if (e.descending) {
            return `${this.visit(e.target)} DESC`;
        }
        return `${this.visit(e.target)}`;
    }

    walkJoin(e: Expression[], sep = ",\r\n\t"): string {
        return e.map((i) => this.visit(i)).join(sep);
    }

}
