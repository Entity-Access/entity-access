import assert from "assert";
import Sql from "../../../sql/Sql.js";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

export default function () {

    const compiler = QueryCompiler.instance;

    let r = compiler.compile((p) => (x) => x.firstName === p.name);

    assert.equal(`"x"."firstName" = $1`, r.text);

    r = compiler.compile((p) => (x) => x.firstName === p.name && x.lastName !== p.name);

    assert.equal(`"x"."firstName" = $1 AND "x"."lastName" <> $2`, r.text);

    const sqlServerCompiler = new QueryCompiler({ quotedLiteral: (x) => `[${x}]`});
    r = sqlServerCompiler.compile((p) => (x) => x.firstName === p.name && x.lastName !== p.name);

    assert.equal(`[x].[firstName] = $1 AND [x].[lastName] <> $2`, r.text);

    r = compiler.compile((p) => (x) => ( x.firstName ?? x.lastName ) === p.name);

    assert.equal(`COALESCE("x"."firstName", "x"."lastName") = $1`, r.text);

    r = compiler.compile((p) => (x) => Sql.text.like(x.firstName, p.name));

    assert.equal(`Sql.text.like("x"."firstName",$1)`, r.text);

}
