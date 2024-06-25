import { NamingConventions } from "../../compiler/NamingConventions.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import { SqlServerSqlMethodTransformer } from "../../compiler/sql-server/SqlServerSqlMethodTransformer.js";
import ArrowToExpression from "../../query/parser/ArrowToExpression.js";
import ExpressionToSqlServer from "./ExpressionToSqlServer.js";
import { SqlServerLiteral } from "./SqlServerLiteral.js";

export default class SqlServerQueryCompiler extends QueryCompiler {

    constructor({
        arrowToExpression = ArrowToExpression,
        expressionToSql = ExpressionToSqlServer,
        quote = SqlServerLiteral.quotedLiteral,
        namingConvention = NamingConventions.pascalCase,
        escapeLiteral = SqlServerLiteral.escapeLiteral,
        sqlMethodTransformer = SqlServerSqlMethodTransformer
    }: Partial<QueryCompiler> = {}) {
        super({
            arrowToExpression,
            expressionToSql,
            namingConvention,
            quote,
            // quotedLiteral,
            escapeLiteral,
            sqlMethodTransformer
        });
    }

}
