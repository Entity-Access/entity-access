import { parseExpression } from "@babel/parser";
import { ArrowFunctionExpression, BinaryExpression, CallExpression, CoalesceExpression, Constant, Expression, Identifier, MemberExpression, NullExpression, NumberLiteral, StringLiteral, TemplateLiteral } from "../ast/Expressions.js";
import { BabelVisitor } from "./BabelVisitor.js";
import * as bpe from "@babel/types";
import EntityType from "../../entity-query/EntityType.js";
import { EntitySource } from "../../model/EntitySource.js";
import Restructure from "./Restructure.js";

type IQueryFragment = string | { name?: string, value?: any };
type IQueryFragments = IQueryFragment[];

export default class ArrowToExpression extends BabelVisitor<Expression> {

    public static transform(fx: (p: any) => (x: any) => any) {

        const rs = new Restructure();

        const node = rs.visit(parseExpression(fx.toString()));
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

    private targetStack: string[] = [];

    protected constructor(
        public param: string,
        public target: string
    ) {
        super();
        this.targetStack.push("Sql");
        this.targetStack.push(target);
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

        // we need to sanitize callee
        this.sanitize(callee);

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

    visitArrowFunctionExpression(node: bpe.ArrowFunctionExpression): Expression {
        const params = node.params.map((x) => this.visit(x));
        const names = this.getParameterNames(node.params);
        this.targetStack.push(... names);
        const body = this.visit(node.body);
        for (const name of names) {
            this.targetStack.pop();
        }
        return ArrowFunctionExpression.create({
            params,
            body
        });
    }

    visitObjectExpression(node: bpe.ObjectExpression): Expression {
        throw new Error("Method not implemented.");
    }
    visitConditionalExpression(node: bpe.ConditionalExpression): Expression {
        throw new Error("Method not implemented.");
    }

    private getParameterNames(params: (bpe.Identifier | bpe.RestElement | bpe.Pattern)[]) {
        const names = [];
        for (const iterator of params) {
            if (iterator.type === "Identifier") {
                names.push(iterator.name);
                continue;
            }
            throw new Error("Rest or Object pattern not yet supported");
        }
        return names;
    }

    private sanitize(node: bpe.Expression | bpe.V8IntrinsicIdentifier) {
        switch(node.type) {
            case "Identifier":
                const name = node.name;
                if (name === this.param || this.targetStack.includes(name)) {
                    return;
                }
                throw new Error(`Unknown identifier ${name}`);
                break;
            case "MemberExpression":
            case "OptionalMemberExpression":
                return this.sanitize(node.object);
        }
        throw new Error(`Unexpected expression type ${node.type}`);
    }

}