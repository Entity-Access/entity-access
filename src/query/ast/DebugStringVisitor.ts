import { ArrayExpression, ArrowFunctionExpression, BigIntLiteral, BinaryExpression, BooleanLiteral, BracketExpression, CallExpression, CoalesceExpression, ConditionalExpression, Constant, DeleteStatement, ExistsExpression, Expression, ExpressionAs, Identifier, InsertStatement, JoinExpression, MemberExpression, NewObjectExpression, NotExits, NullExpression, NumberLiteral, OrderByExpression, ParameterExpression, ReturnUpdated, SelectStatement, StringLiteral, TableLiteral, TemplateElement, TemplateLiteral, UnionAllStatement, UpdateStatement, ValuesStatement } from "./Expressions.js";
import Visitor from "./Visitor.js";

const isBinary = (type) => /^(BinaryExpression|CoalesceExpression)$/.test(type);

export default class DebugStringVisitor extends Visitor<string> {

    static expressionToString(e: Expression) {
        const dsv = new DebugStringVisitor();
        return dsv.visit(e);
    }

    visitArrowFunctionExpression(e: ArrowFunctionExpression) {
        return `(${this.visitArray(e.params)}) => ${this.visit(e.body)}`;
    }

    visitArrayExpression(e: ArrayExpression): string {
        return `[${e.elements.map((x) => this.visit(x)).join(",")}]`;
    }

    visitBigIntLiteral(e: BigIntLiteral): string {
        return e.value.toString() + "n";
    }

    visitBinaryExpression(e: BinaryExpression): string {
        const left = isBinary(e.left.type)
            ? `(${this.visit(e.left)})`
            : this.visit(e.left);
        const right = isBinary(e.right.type)
            ? `(${this.visit(e.right)})`
            : this.visit(e.right);
        return `${left} ${e.operator} ${right}`;
    }

    visitBooleanLiteral(e: BooleanLiteral): string {
        return String(e.value);
    }

    visitCallExpression(e: CallExpression): string {
        return `${this.visit(e.callee)}(${this.visitArray(e.arguments)})`;
    }

    visitCoalesceExpression(e: CoalesceExpression): string {
        const left = isBinary(e.left.type)
            ? `(${this.visit(e.left)})`
            : this.visit(e.left);
        const right = isBinary(e.right.type)
            ? `(${this.visit(e.right)})`
            : this.visit(e.right);
        return `${left} ?? ${right}`;
    }

    visitConditionalExpression(e: ConditionalExpression): string {
        return `${this.visit(e.test)} ? ${this.visit(e.consequent)} : ${this.visit(e.alternate)}`;
    }

    visitConstant(e: Constant): string {
        return `"Constant:${e.value}"`;
    }

    visitBracketExpression(e: BracketExpression): string {
        return `(${this.visit(e.target)})`;
    }

    visitExpressionAs(e: ExpressionAs): string {
        return `${this.visit(e.expression)} as ${this.visit(e.alias)}`;
    }

    visitIdentifier(e: Identifier): string {
        return e.value;
    }

    visitMemberExpression(e: MemberExpression): string {
        return `${this.visit(e.target)}.${this.visit(e.property)}`;
    }

    visitTableLiteral(e: TableLiteral): string {
        if (!e.schema) {
            return this.visit(e.name);
        }
        return `${this.visit(e.schema)}.${this.visit(e.name)}`;
    }

    visitNewObjectExpression(e: NewObjectExpression): string {
        return `({${this.visitArray(e.properties)}})`;
    }

    visitNullExpression(e: NullExpression): string {
        return "null";
    }

    visitNumberLiteral(e: NumberLiteral): string {
        return e.value.toString();
    }

    visitParameterExpression(e: ParameterExpression): string {
        return e.name;
    }

    visitStringLiteral(e: StringLiteral): string {
        return `'${e.value}'`;
    }

    visitTemplateElement(e: TemplateElement): string {
        return `${e.value.cooked}`;
    }

    visitTemplateLiteral(e: TemplateLiteral): string {
        const items = [];
        if (e.quasis?.length) {
            for (let i = 0; i<e.quasis.length; i++) {
                items.push(this.visit(e.quasis[i]));
                if (i<e.value.length) {
                    items.push("${" + this.visit(e.value[i]) + "}" );
                }
            }
        } else {
            for (const iterator of e.value) {
                if (iterator.type === "StringLiteral") {
                    items.push((iterator as StringLiteral).value as string);
                    continue;
                }
                items.push("${" + this.visit(iterator) + "}" );
            }
        }
        return "`" + items.join("") + "`";
    }

    visitDeleteStatement(e: DeleteStatement): string {
        if (e.where) {
            return `DELETE FROM ${this.visit(e.table)} WHERE ${this.visit(e.where)}`;
        }
        return `DELETE FROM ${this.visit(e.table)}`;
    }

    visitExistsExpression(e: ExistsExpression): string {
        return `EXISTS (${this.visit(e.target)})`;
    }

    visitInsertStatement(e: InsertStatement): string {
        return `INSERT INTO ${this.visit(e.table)} ${e.values} ${this.visit(e.returnValues)}`;
    }

    visitJoinExpression(e: JoinExpression): string {
        return `\n${e.joinType} JOIN ${this.visit(e.source)} ${this.visit(e.as)} \n\t\tON ${this.visit(e.where)}\n`;
    }

    visitOrderByExpression(e: OrderByExpression): string {
        return `${e.target} ${e.descending ? "DESC" : "ASC"}`;
    }

    visitReturnUpdated(e: ReturnUpdated): string {
        return `\nRETURNING ${this.visitArray(e.fields)}`;
    }

    visitValuesStatement(e: ValuesStatement): string {
        const rows = e.values.map((x) => `(${this.visit(x[0])})`).join(",\n\t");
        return `(VALUES ${rows}) as ${this.visit(e.as)})`;
    }

    visitSelectStatement(e: SelectStatement): string {
        const select = `SELECT\n\t${this.visitArray(e.fields, ",\n\t")}\n\tFROM ${this.visit(e.source)}`;
        const as = e.sourceParameter ? this.visit(e.sourceParameter): "";
        const joins = e.joins?.length > 0 ? this.visitArray(e.joins, "\n\t") : "";
        const where = e.where ? `\n\tWHERE ${this.visit(e.where)}` : "";
        const orderBy = e.orderBy ? `\n\tORDER BY ${this.visitArray(e.orderBy, "\n\t\tTHEN BY")}`: "";
        const limit = e.limit > 0 ? `\n\tLIMIT ${e.limit}` : "";
        const offset = e.offset > 0 ? `\n\OFFSET ${e.offset}` : "";
        return `${select}${as}${joins}${where}${orderBy}${limit}${offset}`;
    }

    visitUpdateStatement(e: UpdateStatement): string {
        return "UPDATE";
    }

    visitNotExists(e: NotExits): string {
        return ` NOT EXISTS ${this.visit(e.target)}`;
    }

    visitUnionAllStatement(e: UnionAllStatement): string {
        return e.queries.map((x) => this.visit(x)).join("\nUNION ALL\n");
    }

    private visitArray(e: Expression[], separator = ", ") {
        return e.map((x) => this.visit(x)).join(separator);
    }

}