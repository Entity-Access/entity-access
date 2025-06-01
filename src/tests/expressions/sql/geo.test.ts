import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";
import Sql from "../../../sql/Sql.js";

export default function () {

    const compiler = QueryCompiler.instance;

    let r = compiler.execute({ city: { longitude: 10, latitude: 10} }, (p) => (x) => Sql.spatial.distance(x.city, Sql.spatial.location(p.city)));
    assert.equal(`ST_Distance(x."city", ST_Point($1, $2, 4326))`, r.text);


}

