import * as bp from "@babel/parser";
import * as bpe from "@babel/types";

export class BabelVisitor<T> {
    visit(nodeAny: bpe.Expression | bpe.Node): T {
        const node = nodeAny as bpe.Expression;
        switch (node.type) {
            case "BinaryExpression":
                return this.visitBinaryExpression(node);
            case "LogicalExpression":
                return this.visitLogicalExpression(node);
            case "CallExpression":
                return this.visitCallExpression(node);
            case "ArrowFunctionExpression":
                return this.visitArrowFunctionExpression(node);
            case "ConditionalExpression":
                return this.visitConditionalExpression(node);
            case "NullLiteral":
                return this.visitNullLiteral(node);
            case "StringLiteral":
                return this.visitStringLiteral(node);
            case "BigIntLiteral":
                return this.visitBigIntLiteral(node);
            case "BooleanLiteral":
                return this.visitBooleanLiteral(node);
            case "DecimalLiteral":
                return this.visitDecimalLiteral(node);
            case "NumericLiteral":
                return this.visitNumericLiteral(node);
            case "TemplateLiteral":
                return this.visitTemplateLiteral(node);
            case "Identifier":
                return this.visitIdentifier(node);
            case "MemberExpression":
                return this.visitMemberExpression(node);
            case "RegExpLiteral":
            default:
                throw new Error(`Translation from ${node.type} not supported`);
        }
    }
    visitMemberExpression(node: bpe.MemberExpression): T {
        return;
    }
    visitLogicalExpression(node: bpe.LogicalExpression): T {
        return;
    }
    visitIdentifier(node: bpe.Identifier): T {
        return;
    }
    visitTemplateLiteral(node: bpe.TemplateLiteral): T {
        return;
    }
    visitNumericLiteral(node: bpe.NumericLiteral): T {
        return;
    }
    visitDecimalLiteral(node: bpe.DecimalLiteral): T {
        return;
    }
    visitBooleanLiteral(node: bpe.BooleanLiteral): T {
        return;
    }
    visitBigIntLiteral(node: bpe.BigIntLiteral): T {
        return;
    }
    visitStringLiteral(node: bpe.StringLiteral): T {
        return;
    }
    visitNullLiteral(node: bpe.NullLiteral): T {
        return;
    }
    visitConditionalExpression(node: bpe.ConditionalExpression): T {
        return;
    }

    visitArrowFunctionExpression(node: bpe.ArrowFunctionExpression): T {
        return;
    }

    visitCallExpression(node: bpe.CallExpression): T {
        return;
    }

    visitBinaryExpression(node: bpe.BinaryExpression): T {
        return;
    }
}
