import * as bp from "@babel/parser";
import * as bpe from "@babel/types";

export abstract class BabelVisitor<T> {
    visit(node: bpe.Expression | bpe.Node): T {
        // const node = nodeAny as bpe.Expression;
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
            case "ObjectExpression":
                return this.visitObjectExpression(node);
            case "ObjectProperty":
                return this.visitObjectProperty(node);
            case "RegExpLiteral":
            default:
                throw new Error(`Translation from ${node.type} not supported`);
        }
    }
    visitObjectProperty(node: bpe.ObjectProperty): T {
        throw new Error("Method not implemented.");
    }
    abstract visitObjectExpression(node: bpe.ObjectExpression): T;
    abstract visitMemberExpression(node: bpe.MemberExpression): T;
    abstract visitLogicalExpression(node: bpe.LogicalExpression): T;
    abstract visitIdentifier(node: bpe.Identifier): T;
    abstract visitTemplateLiteral(node: bpe.TemplateLiteral): T;
    abstract visitNumericLiteral(node: bpe.NumericLiteral): T;
    abstract visitDecimalLiteral(node: bpe.DecimalLiteral): T;
    abstract visitBooleanLiteral(node: bpe.BooleanLiteral): T;
    abstract visitBigIntLiteral(node: bpe.BigIntLiteral): T;
    abstract visitStringLiteral(node: bpe.StringLiteral): T;
    abstract visitNullLiteral(node: bpe.NullLiteral): T;
    abstract visitConditionalExpression(node: bpe.ConditionalExpression): T;

    abstract visitArrowFunctionExpression(node: bpe.ArrowFunctionExpression): T;

    abstract visitCallExpression(node: bpe.CallExpression): T;

    abstract visitBinaryExpression(node: bpe.BinaryExpression): T;
}
