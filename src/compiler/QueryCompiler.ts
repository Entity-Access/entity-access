import { IClassOf } from "../decorators/IClassOf.js";
import ExpressionToSql from "../query/ast/ExpressionToSql.js";
import { ISqlMethodTransformer, IStringTransformer, ITextQuery } from "../query/ast/IStringTransformer.js";
import { Expression, ParameterExpression, PlaceholderExpression } from "../query/ast/Expressions.js";
import SqlLiteral from "../query/ast/SqlLiteral.js";
import ArrowToExpression from "../query/parser/ArrowToExpression.js";
import PostgreSqlMethodTransformer from "./postgres/PostgreSqlMethodTransformer.js";
import EntityType from "../entity-query/EntityType.js";
import { EntitySource } from "../model/EntitySource.js";
import { IEntityQuery } from "../model/IFilterWithParameter.js";
import { SourceExpression } from "../model/SourceExpression.js";

export class CompiledQuery {
    constructor(
        public root: ParameterExpression,
        public target: ParameterExpression,
        public textQuery: ITextQuery) {}
}

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

    public execute<P = any, T = any>(parameters: P, fx: (p: P) => (x: T) => any, source?: SourceExpression) {
        const { params, target , body } = this.arrowToExpression.transform(fx);
        const exp = new this.expressionToSql(source, params[0], target, this);
        const query = exp.visit(body);
        return this.invoke(query, parameters);
    }

    public compile(fx: (p) => (x) => any) {
        const { params, target , body } = this.arrowToExpression.transform(fx);
        return { params, target, body };
    }

    public compileToSql( source: SourceExpression , fx: (p) => (x) => any) {
        const { params, target , body } = this.arrowToExpression.transform(fx);
        const exp = new this.expressionToSql(source, params[0], target, this);
        const textQuery = exp.visit(body);
        return new CompiledQuery(exp.root,exp.target,textQuery);
    }

    public compileExpression(exp: Expression) {
        const toSql = new this.expressionToSql(null, void 0, void 0, this);
        const query = toSql.visit(exp);
        return this.invoke(query);
    }

    private invoke(query: ITextQuery, p: any = {}) {
        let text = "";
        const values = [];
        for (const iterator of query) {
            if (typeof iterator !== "function") {
                text += iterator;
                continue;
            }
            const value = iterator(p);
            values.push(value);
            text += "$" + values.length;
        }
        return { text, values };
    }

}