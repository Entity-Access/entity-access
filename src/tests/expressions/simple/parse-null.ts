import assert from "assert";
import Sql from "../../../sql/Sql.js";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

export default function () {

    const compiler = QueryCompiler.instance;

    let name = "1";

    let r = compiler.execute({ name }, (p) => (x) => x.firstName === p.name);
    assert.equal(`x."firstName" = $1`, r.text);

    name = null;
    r = compiler.execute({ name }, (p) => (x) => x.firstName === p.name);
    assert.equal(`x."firstName" IS NULL`, r.text);

    r = compiler.execute({ name }, (p) => (x) => x.firstName === null);
    assert.equal(`x."firstName" IS NULL`, r.text);

    name = "1";

    r = compiler.execute({ name }, (p) => (x) => x.firstName !== p.name);
    assert.equal(`x."firstName" <> $1`, r.text);

    name = null;
    r = compiler.execute({ name }, (p) => (x) => x.firstName !== p.name);
    assert.equal(`x."firstName" IS NOT NULL`, r.text);

    r = compiler.execute({ name }, (p) => (x) => x.firstName !== null);
    assert.equal(`x."firstName" IS NOT NULL`, r.text);
}

