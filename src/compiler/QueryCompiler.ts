import { IClassOf } from "../decorators/IClassOf.js";
import ExpressionToSql, { IStringTransformer } from "../query/ast/ExpressionToSql.js";
import { Expression } from "../query/ast/Expressions.js";
import SqlLiteral from "../query/ast/SqlLiteral.js";
import ArrowToExpression from "../query/parser/ArrowToExpression.js";

export default class QueryCompiler {

    public static instance = new QueryCompiler();

    public readonly arrowToExpression: typeof ArrowToExpression;
    public readonly expressionToSql: typeof ExpressionToSql;

    public readonly quotedLiteral: IStringTransformer;
    public readonly escapeLiteral: IStringTransformer;

    constructor(
        {
            arrowToExpression = ArrowToExpression,
            expressionToSql = ExpressionToSql,
            quotedLiteral = JSON.stringify,
            escapeLiteral = SqlLiteral.escapeLiteral
        }: Partial<QueryCompiler> = {}
    ) {
        this.arrowToExpression = arrowToExpression;
        this.expressionToSql = expressionToSql;
        this.escapeLiteral = escapeLiteral;
        this.quotedLiteral = quotedLiteral;
    }

    public compile(fx: (p) => (x) => any) {
        const { param, target , body } = this.arrowToExpression.transform(fx);
        const exp = new ExpressionToSql(param, target, this.quotedLiteral, this.escapeLiteral);
        const text = exp.visit(body);
        return { text, values: exp.values };
    }

    public compileExpression(exp: Expression) {
        const toSql = new ExpressionToSql(void 0, void 0, this.quotedLiteral, this.escapeLiteral);
        const text = toSql.visit(exp);
        return { text, values:  toSql.values};
    }

}