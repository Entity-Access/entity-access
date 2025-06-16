import ExpressionToSql from "../query/ast/ExpressionToSql.js";
import { ISqlMethodTransformer, IStringTransformer, ITextQuery } from "../query/ast/IStringTransformer.js";
import { Expression, ParameterExpression, SelectStatement } from "../query/ast/Expressions.js";
import SqlLiteral from "../query/ast/SqlLiteral.js";
import ArrowToExpression from "../query/parser/ArrowToExpression.js";
import { PostgreSqlMethodTransformer } from "./postgres/PostgreSqlMethodTransformer.js";
import EntityQuery from "../model/EntityQuery.js";
import { NamingConventions } from "./NamingConventions.js";
import RawQuery from "./RawQuery.js";
import TimedCache from "../common/cache/TimedCache.js";

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

    public readonly quote: IStringTransformer;
    public readonly namingConvention: IStringTransformer;
    public readonly escapeLiteral: IStringTransformer;

    public readonly sqlMethodTransformer: ISqlMethodTransformer;

    private parserCache = new TimedCache<string, { params: ParameterExpression[], body: Expression, target: ParameterExpression }>();

    constructor(
        {
            arrowToExpression = ArrowToExpression,
            expressionToSql = ExpressionToSql,
            namingConvention = NamingConventions.snakeCase,
            quote = JSON.stringify,
            escapeLiteral = SqlLiteral.escapeLiteral,
            sqlMethodTransformer = PostgreSqlMethodTransformer
        }: Partial<QueryCompiler> = {}
    ) {
        this.arrowToExpression = arrowToExpression;
        this.expressionToSql = expressionToSql;
        this.escapeLiteral = escapeLiteral;
        this.namingConvention = namingConvention;
        // this.quotedLiteral = quotedLiteral;
        this.quote = quote;
        this.sqlMethodTransformer = sqlMethodTransformer;
    }

    public transform(fx: (p: any) => (x: any) => any, target?: ParameterExpression, outerParameter?: ParameterExpression) {
        const key = `${fx.toString()}-${target?.id ?? '_'}-${outerParameter?.id ?? '_'}`;
        return this.parserCache.getOrCreate(key, this, (k, self) => self.arrowToExpression.transform(fx, target, outerParameter));
    }

    public execute<P = any, T = any>(parameters: P, fx: (p: P) => (x: T) => any, source?: EntityQuery) {
        const { params, target , body } = this.transform(fx, source?.selectStatement.sourceParameter);
        const exp = new this.expressionToSql(source, params[0], target, this);
        const query = exp.visit(body);
        return this.invoke(query, parameters);
    }

    public compile(source: EntityQuery, fx: (p) => (x) => any) {
        const { params, target , body } = this.transform(fx, source?.selectStatement.sourceParameter);
        return { params, target, body };
    }

    public compileToSql( source: EntityQuery , fx: (p) => (x) => any) {
        const { params, target , body } = this.transform(fx, source?.selectStatement.sourceParameter);
        const exp = new this.expressionToSql(source, params[0], target, this);
        const textQuery = exp.visit(body);
        return new CompiledQuery(exp.root,exp.target,textQuery);
    }

    public compileExpression(source: EntityQuery, exp: Expression) {
        const toSql = new this.expressionToSql(source ?? null, null, (exp as SelectStatement)?.sourceParameter ?? source?.selectStatement?.sourceParameter, this);
        const query = toSql.visit(exp);
        return this.invoke(query);
    }

    public compileToRawQuery(source: EntityQuery, exp: Expression, pe: ParameterExpression) {
        const toSql = new this.expressionToSql(source ?? null, pe, null, this);
        const query = toSql.visit(exp);
        return new RawQuery(query);
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
            if (Array.isArray(value)) {
                for (const av of value) {
                    if (typeof av !== "function") {
                        text += av;
                        continue;
                    }
                    values.push(av());
                    text += "$" + values.length;
                }
                continue;
            }
            values.push(value);
            text += "$" + values.length;
        }
        return { text, values };
    }

}