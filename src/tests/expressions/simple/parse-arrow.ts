import assert from "assert";
import Sql from "../../../sql/Sql.js";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

export default function () {

    const compiler = QueryCompiler.instance;

    const name = "Akash";

    let r = compiler.execute({ name }, (p) => (x) => x.firstName === p.name);

    assert.equal(`x.firstName = $1`, r.text);

    r = compiler.execute({ name }, (p) => (x) => x.firstName === p.name && x.lastName !== p.name);

    assert.equal(`(x.firstName = $1) AND (x.lastName <> $2)`, r.text);

    r = compiler.execute({ name }, (p) => (x) => (x.firstName === p.name || x.middleName === p.name) && x.lastName !== p.name);

    assert.equal(`((x.firstName = $1) OR (x.middleName = $2)) AND (x.lastName <> $3)`, r.text);

    r = compiler.execute({ name }, (p) => (x) => x.lastName !== p.name || (x.firstName === p.name || x.middleName === p.name));

    assert.equal(`(x.lastName <> $1) OR ((x.firstName = $2) OR (x.middleName = $3))`, r.text);

    const sqlServerCompiler = new QueryCompiler({});
    r = sqlServerCompiler.execute({ name }, (p) => (x) => x.firstName === p.name && x.lastName !== p.name);

    assert.equal(`(x.firstName = $1) AND (x.lastName <> $2)`, r.text);

    r = compiler.execute({ name }, (p) => (x) => ( x.firstName ?? x.lastName ) === p.name);

    assert.equal(`COALESCE(x.firstName, x.lastName) = $1`, r.text);

    r = compiler.execute({ name }, (p) => (x) => Sql.text.like(x.firstName, p.name));

    assert.equal(`(x.firstName LIKE $1)`, r.text);

    r = compiler.execute({ days: 1 }, (p) => (x) => Sql.date.addDays(x.birthDate, p.days));

    assert.equal(`(x.birthDate + ($1 * interval '1 day'))`, r.text);

    r = compiler.execute({name}, (p) => (x) => Sql.text.startsWith(x.firstName, p.name));

    assert.equal(`starts_with(x.firstName, $1)`, r.text);
    assert.equal("Akash", r.values[0]);

    const code = "1235";
    const key = 13434;
    r = compiler.execute({name, code, key},
        (p) => (x: KeyCode) =>
            x.code === Sql.cast.asNumber(p.code) && x.key === Sql.cast.asText(p.key) );

    assert.equal(`(x.code = ($1 ::double)) AND (x.key = ($2 ::text))`, r.text);

}

type KeyCode = { name: string, code: number, key: string };
