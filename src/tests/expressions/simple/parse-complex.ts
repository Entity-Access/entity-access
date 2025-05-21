import assert from "assert";
import Sql from "../../../sql/Sql.js";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

export default function () {

    const compiler = QueryCompiler.instance;

    const name = "Akash";

    let r = compiler.execute({ name }, (p) => (x) => x.id ? 1 : -1);
    assert.equal(`(CASE WHEN x."id" THEN 1 ELSE -1 END)`, r.text);

    r = compiler.execute({ name }, (p) => (x) => x.id ? 1 : -(5*1));
    assert.equal(`(CASE WHEN x."id" THEN 1 ELSE (-5 * 1) END)`, r.text);


}

type KeyCode = { name: string, code: number, key: string };
