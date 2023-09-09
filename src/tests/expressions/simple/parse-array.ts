import assert from "assert";
import Sql from "../../../sql/Sql.js";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

export default function () {

    const compiler = QueryCompiler.instance;

    const names = ["Akash", "Simmi"];

    let r = compiler.execute({ names }, (p) => (x) => Sql.in(x.firstName, p.names));
    assert.equal("x.firstName IN ($1,$2)", r.text);

    // r = compiler.execute({ names }, (p) => (x) => Sql.text.likeAny(x.firstName, p.names));

    r = compiler.execute({ names }, (p) => (x) => Sql.text.likeAny(x.firstName, p.names));
    assert.equal("((x.firstName like $1) OR (x.firstName like $2))", r.text);


}

