import { parseExpression } from "@babel/parser";
import { ArrowFunctionExpression, BinaryExpression, BooleanLiteral, BracketExpression, CallExpression, CoalesceExpression, ConditionalExpression, Constant, Expression, ExpressionAs, Identifier, MemberExpression, NegateExpression, NewObjectExpression, NotExpression, NullExpression, NumberLiteral, ParameterExpression, StringLiteral, TemplateLiteral } from "../ast/Expressions.js";
import { BabelVisitor } from "./BabelVisitor.js";
import * as bpe from "@babel/types";
import Restructure from "./Restructure.js";
import { NotSupportedError } from "./NotSupportedError.js";

type IQueryFragment = string | { name?: string, value?: any };

const defaultObject = {};

export default class ArrowToExpression extends BabelVisitor<Expression> {

    /**
     * Parses lambda expression function or string to set simple SQL ready AST which
     * transforms basic && to AND etc.
     * @param fx function code (usually lambda expression)
     * @param target parameter target
     * @returns Parsed expression
     */
    public static transform(fx: (p: any) => (x: any) => any, target?: ParameterExpression, outerParameter?: ParameterExpression) {
        const key = fx.toString();
        const rs = new Restructure();
        const node = rs.visit(parseExpression(key));
        return this.transformUncached(node, target, outerParameter);
    }

    /**
     * Since expression parsed as a different parameter in nested lambda (p) => (x) => x..,
     * we need to replace x with provided target to bind x with respective ParameterExpression.
     * As ParameterExpression contains the type and model associated with the table represented by `x`.
     * @param node parsed node
     * @param target parameter to replace
     * @returns transformed node
     */
    private static transformUncached(node: bpe.Node, target?: ParameterExpression, outerParameter?: ParameterExpression): { params: ParameterExpression[], body: Expression, target: ParameterExpression } {

        if (node.type !== "ArrowFunctionExpression") {
            throw new Error("Expecting an arrow function");
        }

        const paramSet = new Map<string, any>();

        let firstOuterParam = null;

        const params = [];

        for (const iterator of node.params) {
            if (iterator.type !== "Identifier") {
                throw new Error("Expecting an identifier");
            }
            if (!firstOuterParam && outerParameter) {
                firstOuterParam = iterator.name;
                paramSet.set(iterator.name, outerParameter);
                params.push(outerParameter);
                continue;
            }
            const p1 = ParameterExpression.create({ name: iterator.name });
            paramSet.set(iterator.name, p1);
            params.push(p1);
        }

        if (outerParameter && firstOuterParam) {
            paramSet.set(firstOuterParam, outerParameter);
        }

        let body = node.body;
        if (body.type !== "ArrowFunctionExpression") {
            throw new Error("Expecting an arrow function");
        }

        const firstTarget = body.params[0];

        let name = "____x";

        if (firstTarget) {

            if (firstTarget.type !== "Identifier") {
                throw new Error("Expecting an identifier");
            }
            name = firstTarget.name;
        }


        target ??= ParameterExpression.create({ name});

        body = body.body;

        const visitor = new this(paramSet, target, name);
        return {
            params,
            target,
            body: visitor.visit(body)
        };
    }

    public readonly leftJoins: string[] = [];

    // private targetStack: Map<any,any> = new Map();

    protected constructor(
        private targetStack: Map<string,any>,
        public target: ParameterExpression,
        targetName: string
    ) {
        super();
        this.targetStack.set("Sql", "Sql");
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
        switch(node.operator) {
            case "-":
                return NegateExpression.create({ expression: this.visit(node.argument)});
        }
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

        const ce = CallExpression.create({
            callee: callee ? this.visit(callee) : void 0,
            arguments: args ? args.map((x) => this.visit(x)) : []
        });

        // for Sql.Coll. , change it to coalesce
        // and move Sql.Coll. inside the first map..
        return this.reAssignCollectionMethods(ce);
    }

    /**
     * We need to change Sql.coll.sum(p.orders.map((o) => o.total)
     * to
     * p.orders.sum((o) => o.total) ?? 0
     * @param ce
     * @returns
     */
    reAssignCollectionMethods(ce: CallExpression) {

        if (ce.callee.type !== "MemberExpression") {
            return ce;
        }

        let callee = ce.callee as MemberExpression;
        const name = [];
        while(callee) {
            name.splice(0, 0, (callee.property as Identifier)?.value);
            const target = callee.target;
            switch(target.type) {
                case "MemberExpression":
                    callee = target as MemberExpression;
                    continue;
                case "Identifier":
                    name.splice(0, 0, (target as Identifier).value);
                    callee = null;
                    break;
                default:
                    return ce;
            }
        }

        if (name[0] !== "Sql") {
            return ce;
        }

        const method = name[2];

        const castMethod = name[1] === "cast" ? name[2] : void 0;

        const reWrittenCe = CallExpression.create({
            callee: Expression.identifier(name.join(".")),
            arguments: ce.arguments,
            castMethod
        });


        if (name[1] !== "coll") {
            // rewrite...
            return reWrittenCe;
        }

        const firstArg = ce.arguments[0] as CallExpression;
        if (firstArg?.type !== "CallExpression") {
            return reWrittenCe;
        }

        const mapCallee = firstArg.callee as MemberExpression;
        if (mapCallee?.type !== "MemberExpression") {
            return reWrittenCe;
        }

        const left = CallExpression.create({
            collectionMethod: method,
            callee: MemberExpression.create({
                target: mapCallee.target,
                property: Expression.identifier(method),
                isCollectionMethod: true
            }),
            arguments: firstArg.arguments
        });

        // move it inside...
        const rewritten = CoalesceExpression.create({
            left: BracketExpression.create({ target: left }) ,
            right: NumberLiteral.zero
        });
        return rewritten;
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