import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

export default function () {

    const compiler = QueryCompiler.instance;

    const name = "Akash";

    let r = compiler.execute({ name }, (x, p) => x.id ? 1 : -1);
    assert.equal(`(CASE WHEN x."id" THEN 1 ELSE -1 END)`, r.text);

    r = compiler.execute({ name }, (x, p) => x.id ? 1 : -(5*1));
    assert.equal(`(CASE WHEN x."id" THEN 1 ELSE (-5 * 1) END)`, r.text);


}
