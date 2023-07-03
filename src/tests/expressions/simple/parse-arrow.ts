import assert from "assert";
import Sql from "../../../sql/Sql.js";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

export default function () {

    const compiler = QueryCompiler.instance;

    const name = "Akash";

    let r = compiler.execute({ name }, (p) => (x) => x.firstName === p.name);

    assert.equal(`"x"."firstName" = $1`, r.text);

    r = compiler.execute({ name }, (p) => (x) => x.firstName === p.name && x.lastName !== p.name);

    assert.equal(`("x"."firstName" = $1) AND ("x"."lastName" <> $2)`, r.text);

    r = compiler.execute({ name }, (p) => (x) => (x.firstName === p.name || x.middleName === p.name) && x.lastName !== p.name);

    assert.equal(`(("x"."firstName" = $1) OR ("x"."middleName" = $2)) AND ("x"."lastName" <> $3)`, r.text);


    const sqlServerCompiler = new QueryCompiler({ quotedLiteral: (x) => `[${x}]`});
    r = sqlServerCompiler.execute({ name }, (p) => (x) => x.firstName === p.name && x.lastName !== p.name);

    assert.equal(`([x].[firstName] = $1) AND ([x].[lastName] <> $2)`, r.text);

    r = compiler.execute({ name }, (p) => (x) => ( x.firstName ?? x.lastName ) === p.name);

    assert.equal(`COALESCE("x"."firstName", "x"."lastName") = $1`, r.text);

    r = compiler.execute({ name }, (p) => (x) => Sql.text.like(x.firstName, p.name));

    assert.equal(`("x"."firstName" LIKE $1)`, r.text);

    r = compiler.execute({ days: 1 }, (p) => (x) => Sql.date.addDays(x.birthDate, p.days));

    assert.equal(`("x"."birthDate" + ($1 * interval '1 day'))`, r.text);

    r = compiler.execute({name}, (p) => (x) => Sql.text.startsWith(x.firstName, p.name));

    assert.equal(`starts_with("x"."firstName", $1)`, r.text);
    assert.equal("Akash", r.values[0]);

}
