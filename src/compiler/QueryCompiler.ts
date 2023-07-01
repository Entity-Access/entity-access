import { IClassOf } from "../decorators/IClassOf.js";
import ExpressionToSql from "../query/ast/ExpressionToSql.js";
import { ISqlMethodTransformer, IStringTransformer } from "../query/ast/IStringTransformer.js";
import { Expression } from "../query/ast/Expressions.js";
import SqlLiteral from "../query/ast/SqlLiteral.js";
import ArrowToExpression from "../query/parser/ArrowToExpression.js";
import PostgreSqlMethodTransformer from "./postgres/SqlMethodTransformer.js";
import EntityType from "../entity-query/EntityType.js";
import { EntitySource } from "../model/EntityModel.js";

export default class QueryCompiler {

    public static instance = new QueryCompiler();

    public readonly arrowToExpression: typeof ArrowToExpression;
    public readonly expressionToSql: typeof ExpressionToSql;

    public readonly quotedLiteral: IStringTransformer;
    public readonly escapeLiteral: IStringTransformer;

    public readonly sqlMethodTransformer: ISqlMethodTransformer;

    constructor(
        {
            arrowToExpression = ArrowToExpression,
            expressionToSql = ExpressionToSql,
            quotedLiteral = JSON.stringify,
            escapeLiteral = SqlLiteral.escapeLiteral,
            sqlMethodTransformer = PostgreSqlMethodTransformer
        }: Partial<QueryCompiler> = {}
    ) {
        this.arrowToExpression = arrowToExpression;
        this.expressionToSql = expressionToSql;
        this.escapeLiteral = escapeLiteral;
        this.quotedLiteral = quotedLiteral;
        this.sqlMethodTransformer = sqlMethodTransformer;
    }

    public compile(fx: (p) => (x) => any, source?: EntitySource) {
        const { param, target , body } = this.arrowToExpression.transform(fx);
        const exp = new ExpressionToSql(param, target, this.quotedLiteral, this.escapeLiteral, this.sqlMethodTransformer);
        const text = exp.visit(body);
        return { text, values: exp.values };
    }

    public compileExpression(exp: Expression) {
        const toSql = new ExpressionToSql(void 0, void 0, this.quotedLiteral, this.escapeLiteral);
        const text = toSql.visit(exp);
        return { text, values:  toSql.values};
    }

}