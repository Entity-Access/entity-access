import { ArrowFunctionExpression, BigIntLiteral, BinaryExpression, BooleanLiteral, CallExpression, CoalesceExpression, ConditionalExpression, Constant, DeleteStatement, Expression, ExpressionAs, Identifier, MemberExpression, NewObjectExpression, NullExpression, NumberLiteral, ParameterExpression, QuotedLiteral, StringLiteral, TableLiteral, TemplateElement, TemplateLiteral } from "./Expressions.js";
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
        return `${e.test} ? ${e.consequent} : ${e.alternate}`;
    }

    visitConstant(e: Constant): string {
        return `"Constant:${e.value}"`;
    }

    visitExpressionAs(e: ExpressionAs): string {
        return `${e.expression} as ${e.alias}`;
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

    visitQuotedLiteral(e: QuotedLiteral): string {
        return `"${e.literal}"`;
    }

    visitStringLiteral(e: StringLiteral): string {
        return `"${e.value}"`;
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

    private visitArray(e: Expression[], separator = ", ") {
        return e.map((x) => this.visit(x)).join(separator);
    }
}