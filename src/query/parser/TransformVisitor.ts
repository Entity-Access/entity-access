import * as bpe from "@babel/types";
import { BabelVisitor } from "./BabelVisitor.js";

export default class TransformVisitor extends BabelVisitor<bpe.Node> {

    transform<T>(n:T) {
        if (!n) {
            return n;
        }
        if (Array.isArray(n)) {
            return n.map((x) => this.transform(x));
        }
        return this.visit(n as any);
    }

    visitTemplateElement(node: bpe.TemplateElement): bpe.Node {
        return node;
    }

    visitObjectExpression(node: bpe.ObjectExpression): bpe.Node {
        return bpe.objectExpression(
            this.transform(node.properties)
        );
    }
    visitMemberExpression(node: bpe.MemberExpression): bpe.Node {
        return bpe.memberExpression(this.transform(node.object), this.transform(node.property), node.computed, node.optional);
    }
    visitLogicalExpression(node: bpe.LogicalExpression): bpe.Node {
        return bpe.logicalExpression(node.operator, this.transform(node.left), this.transform(node.right));
    }
    visitIdentifier(node: bpe.Identifier): bpe.Node {
        return node;
    }
    visitTemplateLiteral(node: bpe.TemplateLiteral): bpe.Node {
        return bpe.templateLiteral(this.transform(node.quasis), this.transform(node.expressions));
    }
    visitNumericLiteral(node: bpe.NumericLiteral): bpe.Node {
        return node;
    }
    visitDecimalLiteral(node: bpe.DecimalLiteral): bpe.Node {
        return node;
    }
    visitBooleanLiteral(node: bpe.BooleanLiteral): bpe.Node {
        return node;
    }
    visitBigIntLiteral(node: bpe.BigIntLiteral): bpe.Node {
        return node;
    }
    visitStringLiteral(node: bpe.StringLiteral): bpe.Node {
        return node;
    }
    visitNullLiteral(node: bpe.NullLiteral): bpe.Node {
        return node;
    }
    visitConditionalExpression(node: bpe.ConditionalExpression): bpe.Node {
        return bpe.conditionalExpression(
            this.transform(node.test),
            this.transform(node.consequent),
            this.transform(node.alternate));
    }
    visitArrowFunctionExpression(node: bpe.ArrowFunctionExpression): bpe.Node {
        return bpe.arrowFunctionExpression(this.transform(node.params), this.transform(node.body), node.async);
    }
    visitCallExpression(node: bpe.CallExpression): bpe.Node {
        return bpe.callExpression(this.transform(node.callee), this.transform(node.arguments));
    }
    visitBinaryExpression(node: bpe.BinaryExpression): bpe.Node {
        return bpe.binaryExpression(node.operator, this.transform(node.left), this.transform(node.right));
    }

    visitObjectProperty(node: bpe.ObjectProperty): bpe.Node {

        let key = node.key;
        if (node.key.type !== "Identifier") {
            key = this.transform(key);
        }

        const value = this.transform(node.value);

        return bpe.objectProperty(key, value, node.computed, node.shorthand, node.decorators);
    }

}