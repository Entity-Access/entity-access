import * as bpe from "@babel/types";
import { BabelVisitor } from "./BabelVisitor.js";
import { NotSupportedError } from "./NotSupportedError.js";
import TransformVisitor from "./TransformVisitor.js";


/**
 * This class will restructure code from
 * 1. ({ a } => a) to (p => p.a)
 * 2. Turning (Negate)(literal) to (-literal) .. changing sign
 * 3. ((x) => (x.joinedTable.x ..) || (...)) to ((x) => (x.joinedTable?.x))
 *      `?.` will make join nullable and left join will be enforced.
 */
export default class Restructure extends TransformVisitor {

    private map: Map<string, bpe.Node> = new Map();

    visitUnaryExpression(node: bpe.UnaryExpression): bpe.Node {
        if (node.operator === "-") {
            if (node.argument.type === "NumericLiteral") {
                return bpe.numericLiteral(-node.argument.value);
            }
        }
        return node;
    }

    visitLogicalExpression(node: bpe.LogicalExpression): bpe.Node {
        if (node.operator !== "||") {
            return node;
        }
        // convert every second member to ?.
        return node;
    }

    visitTemplateElement(node: bpe.TemplateElement): bpe.Node {
        return node;
    }

    visitArrowFunctionExpression(node: bpe.ArrowFunctionExpression): bpe.Node {

        // we need to restructure identifiers from destructure

        node.params = node.params.map((x) => this.toIdentifier(x));

        node.body = this.visit(node.body) as bpe.Expression;

        return node;
    }

    visitIdentifier(node: bpe.Identifier): bpe.Node {
        return this.map.get(node.name) ?? node;
    }

    toIdentifier(x: bpe.Identifier | bpe.Pattern | bpe.RestElement): bpe.Identifier {
        switch(x.type) {
            case "Identifier":
                return x;
            case "ObjectPattern":
                const id = `x${this.map.size + 1}`;
                const idExp = bpe.identifier(id);
                this.convertPattern(idExp, x);
                return idExp;
            case "ArrayPattern":
            case "AssignmentPattern":
            case "RestElement":
                throw new NotSupportedError();
        }
    }

    convertPattern(parentExp: bpe.Expression, x: bpe.ObjectPattern) {
        for (const iterator of x.properties) {
            switch(iterator.type) {
                case "RestElement":
                    throw new NotSupportedError();
                case "ObjectProperty":
                    switch(iterator.key.type){
                        case "Identifier":
                            const childExp = bpe.memberExpression(parentExp, iterator.key);
                            this.map.set(iterator.key.name, childExp);
                            switch(iterator.value.type) {
                                case "ObjectPattern":
                                    this.convertPattern(childExp, iterator.value);
                                    break;
                            }
                        break;
                    }
            }
        }
    }

}