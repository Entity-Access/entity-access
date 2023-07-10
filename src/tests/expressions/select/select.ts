import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";
import ArrowToExpression from "../../../query/parser/ArrowToExpression.js";
import { ExpressionAs, Identifier, MemberExpression, NewObjectExpression, QuotedLiteral } from "../../../query/ast/Expressions.js";
import ExpressionToSql from "../../../query/ast/ExpressionToSql.js";

type ICustomer = { firstName: string; lastName: string; emailAddress: string; birthDate: Date };

export default function() {


    const compiler = QueryCompiler.instance;

    const name = "Akash";

    let r = compiler.execute({ name }, (p) => ({ firstName, lastName, emailAddress }: ICustomer) => ({ emailAddress, name: `${firstName} ${lastName}` }));

    assert.strictEqual(`FROM ("x1"."emailAddress" AS "emailAddress",CONCAT("x1"."firstName",$1,"x1"."lastName") AS "name")`, r.text);

    r = compiler.execute({ name }, (p) => ({ id }) => ({ error: `${id > 0 ? "Error" : ""}` }));

    assert.strictEqual(`FROM (CONCAT((CASE WHEN "x1"."id" > $1 THEN $2 ELSE $3 END)) AS "error")`, r.text);

}