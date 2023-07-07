import { parseExpression } from "@babel/parser";
import { ArrowFunctionExpression, BinaryExpression, CallExpression, CoalesceExpression, ConditionalExpression, Constant, Expression, ExpressionAs, Identifier, MemberExpression, NewObjectExpression, NullExpression, NumberLiteral, ParameterExpression, QuotedLiteral, StringLiteral, TemplateLiteral } from "../ast/Expressions.js";
import { BabelVisitor } from "./BabelVisitor.js";
import * as bpe from "@babel/types";
import EntityType from "../../entity-query/EntityType.js";
import { EntitySource } from "../../model/EntitySource.js";
import Restructure from "./Restructure.js";
import { NotSupportedError } from "./NotSupportedError.js";

type IQueryFragment = string | { name?: string, value?: any };
type IQueryFragments = IQueryFragment[];

export default class ArrowToExpression extends BabelVisitor<Expression> {

    public static transform(fx: (p: any) => (x: any) => any) {

        const rs = new Restructure();

        const node = rs.visit(parseExpression(fx.toString()));
        if (node.type !== "ArrowFunctionExpression") {
            throw new Error("Expecting an arrow function");
        }

        const params = [] as ParameterExpression[];

        for (const iterator of node.params) {
            if (iterator.type !== "Identifier") {
                throw new Error("Expecting an identifier");
            }
            params.push(ParameterExpression.create({ name: iterator.name }));
        }

        let body = node.body;
        if (body.type !== "ArrowFunctionExpression") {
            throw new Error("Expecting an arrow function");
        }

        const firstTarget = body.params[0];
        if (firstTarget.type !== "Identifier") {
            throw new Error("Expecting an identifier");
        }

        const target = ParameterExpression.create({ name: firstTarget.name});

        body = body.body;

        const visitor = new this(params, target);
        return {
            params,
            target,
            body: visitor.visit(body)
        };
    }

    public readonly leftJoins: string[] = [];

    private targetStack: Map<any,any> = new Map();

    protected constructor(
        public params: ParameterExpression[],
        public target: ParameterExpression
    ) {
        super();
        this.targetStack.set("Sql", "Sql");
        for (const iterator of params) {
            this.targetStack.set(iterator.name, iterator);
        }
        this.targetStack.set(target.name, target);
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
        // const value = node.expressions.map((x) => this.visit(x));
        const value = [] as Expression[];
        for (let index = 0; index < node.quasis.length; index++) {
            const { value: { cooked }} = node.quasis[index];
            if (cooked) {
                value.push(StringLiteral.create({ value: cooked }));
            }
            if (index < node.expressions.length) {
                value.push(this.visit(node.expressions[index]));
            }
        }
        return TemplateLiteral.create({ value });
    }

    visitTemplateElement(node: bpe.TemplateElement): Expression {
        throw new NotSupportedError();
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
                throw new NotSupportedError(`Operator ${operator}`);
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
        const scopedName = this.targetStack.get(value);
        if (typeof scopedName === "object") {
            return scopedName;
        }
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
        const params = [] as ParameterExpression[];
        const names = [];
        for (const iterator of node.params) {
            if (iterator.type !== "Identifier") {
                throw new NotSupportedError();
            }
            names.push(iterator.name);
            const p = ParameterExpression.create({ value: iterator.name });
            this.targetStack.set(iterator.name, p);
        }
        const body = this.visit(node.body);
        for (const name of names) {
            this.targetStack.delete(name);
        }
        return ArrowFunctionExpression.create({
            params,
            body
        });
    }

    visitObjectExpression(node: bpe.ObjectExpression): Expression {
        const properties = [] as ExpressionAs[];
        for (const iterator of node.properties) {
            switch(iterator.type) {
                case "ObjectProperty":
                    switch(iterator.key.type) {
                        case "Identifier":
                            properties.push( ExpressionAs.create({
                                alias: QuotedLiteral.create({ literal: iterator.key.name}),
                                expression: this.visit(iterator.value)
                            }) );
                            break;
                        default:
                            throw new NotSupportedError();
                    }
                    continue;
                default:
                    throw new NotSupportedError();
            }
        }
        return NewObjectExpression.create({
            properties
        });
    }

    visitConditionalExpression(node: bpe.ConditionalExpression): Expression {
        return ConditionalExpression.create({
            test: this.visit(node.test),
            consequent: this.visit(node.consequent),
            alternate: this.visit(node.alternate)
        });
    }

    private sanitize(node: bpe.Expression | bpe.V8IntrinsicIdentifier) {
        switch(node.type) {
            case "Identifier":
                const name = node.name;
                const scopedName = this.targetStack.get(name);
                if (scopedName === null) {
                    throw new Error(`Unknown identifier ${name}`);
                }
                break;
            case "MemberExpression":
            case "OptionalMemberExpression":
                return this.sanitize(node.object);
        }
        throw new Error(`Unexpected expression type ${node.type}`);
    }

}