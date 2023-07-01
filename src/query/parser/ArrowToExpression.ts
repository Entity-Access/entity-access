import { parseExpression } from "@babel/parser";
import { BinaryExpression, CallExpression, CoalesceExpression, Constant, Expression, Identifier, MemberExpression, NullExpression, NumberLiteral, StringLiteral, TemplateLiteral } from "../ast/Expressions.js";
import { BabelVisitor } from "./BabelVisitor.js";
import * as bpe from "@babel/types";
import EntityType from "../../entity-query/EntityType.js";
import { EntitySource } from "../../model/EntityModel.js";

type IQueryFragment = string | { name?: string, value?: any };
type IQueryFragments = IQueryFragment[];

export default class ArrowToExpression extends BabelVisitor<Expression> {

    public static transform(fx: (p: any) => (x: any) => any) {
        const node = parseExpression(fx.toString());
        if (node.type !== "ArrowFunctionExpression") {
            throw new Error("Expecting an arrow function");
        }

        const firstParam = node.params[0];
        if (firstParam.type !== "Identifier") {
            throw new Error("Expecting an identifier");
        }

        const paramName = firstParam.name;

        let body = node.body;
        if (body.type !== "ArrowFunctionExpression") {
            throw new Error("Expecting an arrow function");
        }

        const firstTarget = body.params[0];
        if (firstTarget.type !== "Identifier") {
            throw new Error("Expecting an identifier");
        }

        const target = firstTarget.name;

        body = body.body;

        const visitor = new this(paramName, target);
        return {
            param: paramName,
            target,
            body: visitor.visit(body)
        };
    }

    public readonly leftJoins: string[] = [];

    protected constructor(
        public param: string,
        public target: string
    ) {
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

    visitLogicalExpression(node: bpe.LogicalExpression): Expression {
        const left = this.visit(node.left);
        const right = this.visit(node.right);
        let operator = node.operator as string;
        switch(node.operator) {
            case "&&":
                operator = "AND";
                break;
            case "||":
                operator = "OR";
                break;
            case "??":
                return CoalesceExpression.create({ left, right });
        }
        return BinaryExpression.create({ left, operator, right });
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
            case "===":
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

    visitIdentifier({ name: value }: bpe.Identifier): Expression {
        return Identifier.create({ value });
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