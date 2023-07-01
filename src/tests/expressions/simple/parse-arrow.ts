import assert from "assert";
import ExpressionToQueryVisitor from "../../../query/ast/ExpressionToQueryVisitor.js";
import SqlTranslator from "../../../query/parser/SqlTranslator.js";

export default function () {

    let r = ExpressionToQueryVisitor.toQuery((p) => (x) => x.firstName === p.name);

    assert.equal(`"x"."firstName" = $1`, r.text);

    r = ExpressionToQueryVisitor.toQuery((p) => (x) => x.firstName === p.name && x.lastName !== p.name);

    assert.equal(`"x"."firstName" = $1 AND "x"."lastName" <> $2`, r.text);

    r = ExpressionToQueryVisitor.toQuery((p) => (x) => x.firstName === p.name && x.lastName !== p.name, (x) => `[${x}]`);

    assert.equal(`[x].[firstName] = $1 AND [x].[lastName] <> $2`, r.text);

    r = ExpressionToQueryVisitor.toQuery((p) => (x) => ( x.firstName ?? x.lastName ) === p.name);

    assert.equal(`COALESCE("x"."firstName", "x"."lastName") = $1`, r.text);

}
