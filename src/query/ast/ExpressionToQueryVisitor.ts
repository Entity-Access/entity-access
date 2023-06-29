import { Constant, Expression, ExpressionAs, ExpressionType, InsertStatement, QuotedLiteral, SelectStatement, TableLiteral, ValuesStatement } from "./Expressions.js";
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

    visitInsertStatement(e: InsertStatement): string {
        if (e.values instanceof ValuesStatement) {
            let rows = [];
            for (const iterator of e.values.values) {
                const row = [];
                for (const v of iterator) {
                    row.push(this.visit(v));
                }
                rows.push("(" + row.join(",") + ")");
            }
            return `INSERT INTO ${this.visit(e.table)} (${this.walkJoin(e.values.fields)}) VALUES ${rows.join(",")}`
        }
        return `INSERT INTO ${this.visit(e.table)} ${this.visit(e.values)}`;

    }
    
    walkJoin(e: Expression[], sep = ",\r\n\t"): string {
        return e.map((i) => this.visit(i)).join(sep);
    }

}
