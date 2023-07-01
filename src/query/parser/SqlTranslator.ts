import { BinaryExpression, CallExpression, Constant, Expression, MemberExpression, NullExpression, NumberLiteral, StringLiteral, TemplateLiteral } from "../ast/Expressions.js";
import { BabelVisitor } from "./BabelVisitor.js";
import * as bpe from "@babel/types";

type IQueryFragment = string | { name?: string, value?: any };
type IQueryFragments = IQueryFragment[];

export default class SqlTranslator extends BabelVisitor<Expression> {

    constructor(public param: string) {
        super();
    }

    visitBigIntLiteral({ value }: bpe.BigIntLiteral) {
        return Constant.create({ value });
    }

    visitBooleanLiteral({ value }: bpe.BooleanLiteral) {
        return Constant.create({ value });
    }

    visitDecimalLiteral( { value }: bpe.DecimalLiteral) {
        return Constant.create({ value });
    }

    visitNullLiteral(node: bpe.NullLiteral) {
        return NullExpression.create({});
    }

    visitStringLiteral({ value }: bpe.StringLiteral) {
        return StringLiteral.create({ value });
    }

    visitNumericLiteral({ value }: bpe.NumericLiteral) {
        return NumberLiteral.create({ value });
    }

    visitTemplateLiteral(node: bpe.TemplateLiteral) {
        const value = node.expressions.map((x) => this.visit(x));
        return TemplateLiteral.create({ value });
    }

    visitBinaryExpression(node: bpe.BinaryExpression) {
        let operator = node.operator as string;
        switch(node.operator) {
            case "!=":
            case "!==":
                operator = "<>";
                break;
            case "<":
            case ">":
            case "*":
            case "%":
            case "/":
            case "+":
            case "-":
            case ">=":
            case "<=":
                break;
            case "==":
                operator = "=";
                break;
            default:
                throw new Error(`Operator ${operator} not supported`);
        }
        const left = this.visit(node.left);
        const right = this.visit(node.right);
        return BinaryExpression.create({ left , operator , right });
    }

    visitCallExpression({ callee, arguments: args }: bpe.CallExpression) {
        return CallExpression.create({
            callee: callee ? this.visit(callee) : void 0,
            arguments: args ? args.map((x) => this.visit(x)) : []
        });
    }

    visitMemberExpression({ object , property: key, computed }: bpe.MemberExpression) {
        const property = this.visit(key);
        return MemberExpression.create({
            target: this.visit(object),
            property,
            computed
        });
    }

}