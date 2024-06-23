import { parseExpression } from "@babel/parser";
import { ArrowFunctionExpression, BinaryExpression, BooleanLiteral, CallExpression, CoalesceExpression, ConditionalExpression, Constant, Expression, ExpressionAs, Identifier, MemberExpression, NewObjectExpression, NotExpression, NullExpression, NumberLiteral, ParameterExpression, StringLiteral, TemplateLiteral } from "../ast/Expressions.js";
import { BabelVisitor } from "./BabelVisitor.js";
import * as bpe from "@babel/types";
import Restructure from "./Restructure.js";
import { NotSupportedError } from "./NotSupportedError.js";
import TimedCache from "../../common/cache/TimedCache.js";

type IQueryFragment = string | { name?: string, value?: any };

const parsedCache = new TimedCache<string, bpe.Node>();

const parameterCacheSymbol = Symbol("parameterCacheSymbol");

const defaultObject = {};

export default class ArrowToExpression extends BabelVisitor<Expression> {

    /**
     * Parses lambda expression function or string to set simple SQL ready AST which
     * transforms basic && to AND etc.
     * @param fx function code (usually lambda expression)
     * @param target parameter target
     * @returns Parsed expression
     */
    public static transform(fx: (p: any) => (x: any) => any, target?: ParameterExpression) {
        const key = fx.toString();
        const node = parsedCache.getOrCreate(key, fx, (k, f) => {
            const rs = new Restructure();
            return rs.visit(parseExpression(f.toString()));
        });
        return this.transformUncached(node, target);
    }

    /**
     * Since expression parsed as a different parameter in nested lambda (p) => (x) => x..,
     * we need to replace x with provided target to bind x with respective ParameterExpression.
     * As ParameterExpression contains the type and model associated with the table represented by `x`.
     * @param node parsed node
     * @param target parameter to replace
     * @returns transformed node
     */
    private static transformUncached(node: bpe.Node, tx?: ParameterExpression) {

        const cache = node[parameterCacheSymbol] ??= new TimedCache<ParameterExpression,bpe.Node>();

        return cache.getOrCreate(tx ?? defaultObject, tx, (_, target) => {

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

            target ??= ParameterExpression.create({ name: firstTarget.name});

            body = body.body;

            const visitor = new this(params, target, firstTarget.name);
            return {
                params,
                target,
                body: visitor.visit(body)
            };
        });
    }

    public readonly leftJoins: string[] = [];

    private targetStack: Map<any,any> = new Map();

    protected constructor(
        public params: ParameterExpression[],
        public target: ParameterExpression,
        targetName: string
    ) {
        super();
        this.targetStack.set("Sql", "Sql");
        for (const iterator of params) {
            this.targetStack.set(iterator.name, iterator);
        }
        if (targetName) {
            this.targetStack.set(targetName, target);
        }
        if (target?.name) {
            this.targetStack.set(target.name, target);
        }
    }

    visitBigIntLiteral({ value }: bpe.BigIntLiteral) {
        return Constant.create({ value });
    }

    visitBooleanLiteral({ value }: bpe.BooleanLiteral) {
        return BooleanLiteral.create({ value });
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

    visitUnaryExpression(node: bpe.UnaryExpression): Expression {
        return NotExpression.create({ expression: this.visit(node.argument)});
    }

    visitTemplateLiteral(node: bpe.TemplateLiteral) {
        // const value = node.expressions.map((x) => this.visit(x));

        if (node.quasis.length === 1 && node.expressions.length === 0) {
            const { value: { cooked } } = node.quasis[0];
            return StringLiteral.create({ value: cooked });
        }

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

    visitArrayExpression(node: bpe.ArrayExpression): Expression {
        return Expression.array(node.elements.map((e) => this.visit(e)));
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
            case "in":
                operator = "in";
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

        // change Sql.coll. with arrow functions to move it inside

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
            const p = ParameterExpression.create({ name: iterator.name });
            this.targetStack.set(iterator.name, p);
            params.push(p);
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
                                alias: Expression.identifier(iterator.key.name),
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
                if (scopedName === null || scopedName === void 0) {
                    throw new Error(`Unknown identifier ${name}`);
                }
                return;
            case "CallExpression":
                for (const iterator of node.arguments) {
                    this.visit(iterator as bpe.Expression);
                }
                return;
            case "MemberExpression":
            case "OptionalMemberExpression":
                return this.sanitize(node.object);
        }
        throw new Error(`Unexpected expression type ${node.type}`);
    }

}