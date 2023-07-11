import EntityType from "../../entity-query/EntityType.js";
import { ExpressionType, SelectStatement } from "../ast/Expressions.js";
import ArrowToExpression from "../parser/ArrowToExpression.js";
import { NotSupportedError } from "../parser/NotSupportedError.js";

function expand(select: SelectStatement, p) {
    const expression = ArrowToExpression.transform((_____________________x) => p);
    expandNode(select, select.model, expression.body as ExpressionType );
    return select;
}

function expandNode(select: SelectStatement, model: EntityType, node: ExpressionType): [SelectStatement, EntityType] {

    if (node.type === "ArrayExpression") {
        for (const iterator of node.elements) {
            expandNode(select, model,  iterator as ExpressionType);
        }
        return;
    }

    if(node.type === "CallExpression") {
        const callee = node.callee as ExpressionType;
        if (callee.type !== "MemberExpression") {
            throw new NotSupportedError(callee.type);
        }
        const property = callee.property as ExpressionType;
        if (property.type !== "Identifier") {
            throw new NotSupportedError(property.type);
        }
        if (property.value !== "forEach") {
            throw new NotSupportedError(property.value);
        }
        const r = expandNode(select, model, callee.target as ExpressionType);
        
    }

    if (node.type !== "MemberExpression") {
        throw new NotSupportedError(node.type);
    }

    const type = select.model;
}


export const QueryExpander = {
    expand,
    expandNode
};