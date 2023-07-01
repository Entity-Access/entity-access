import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

export default function() {
    const compiler = QueryCompiler.instance;

    let r = compiler.compile((p) => (x) => x.customers.any((c) => c.firstName === p.name));

    assert.equal(`("x"."firstName" = $1)`, r.text);

}
