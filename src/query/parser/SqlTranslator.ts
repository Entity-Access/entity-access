import { BabelVisitor } from "./BabelVisitor.js";
import * as bpe from "@babel/types";

type IQueryFragment = string | { name?: string, value?: any };
type IQueryFragments = IQueryFragment[];

export default class SqlTranslator extends BabelVisitor<IQueryFragments> {

    constructor(public param: string) {
        super();
    }

    visitBigIntLiteral(node: bpe.BigIntLiteral): IQueryFragments {
        return [ { value: node.value }];
    }
    
    visitBooleanLiteral(node: bpe.BooleanLiteral): IQueryFragments {
        return [ { value: node.value }];
    }

    visitDecimalLiteral(node: bpe.DecimalLiteral): IQueryFragments {
        return [ { value: node.value }];
    }

    visitNullLiteral(node: bpe.NullLiteral): IQueryFragments {
        return [ { value: null }];
    }

    visitStringLiteral(node: bpe.StringLiteral): IQueryFragments {
        return [ { value: node.value }];
    }

    visitNumericLiteral(node: bpe.NumericLiteral): IQueryFragments {
        return [ { value: node.value }];
    }

    visitTemplateLiteral(node: bpe.TemplateLiteral): IQueryFragments {
        if (node.expressions.length === 0) {
            return [];
        }
        const r: IQueryFragments = ["CONCAT("];
        for (const iterator of node.expressions) {
            if (r.length > 1) {
                r.push(",");
            }
            r.push(... this.visit(iterator as bpe.Expression))
        }
        r.push(")");
        return r;
    }

    visitBinaryExpression(node: bpe.BinaryExpression): IQueryFragments {
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
        return [... this.visit(node.left), operator , ... this.visit(node.right)];
    }

    visitCallExpression(node: bpe.CallExpression): IQueryFragments {
        const r = [... this.visit(node.callee), "("];
        let addSep = false;
        for (const iterator of node.arguments) {
            if(addSep) {
                r.push(",");
            }
            addSep = true;
            r.push(... this.visit(iterator));
        }
        r.push(")");
        return r;
    }

}