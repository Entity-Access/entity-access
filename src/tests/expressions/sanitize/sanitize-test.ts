import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

declare let pg_kill: any;

export default function () {

    const compiler = QueryCompiler.instance;

    const name = "Akash";

    assert.throws(()=>
        compiler.execute({ name }, (p) => (x) => pg_kill(9))
    );


}
