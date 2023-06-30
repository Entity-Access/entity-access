import * as assert from "assert";
import { IQuery, Query, QueryPart } from "../../query/Query.js";

export default function () {
    const id = 1;
    const q = Query.create `SELECT * FROM Accounts WHERE ${id}`;
    assert.equal("SELECT * FROM Accounts WHERE @p0", q.toString());

    const p = q.parts[1] as QueryPart;
    assert.equal(id, p.value);

    // lets combine multiple queries...

    const id2 = 2;

    const orConstraints = [];
    orConstraints.push(Query.create `ID == ${id}`);
    orConstraints.push(Query.create `ID == ${id2}`);

    const final = Query.create `SELECT * FROM Accounts WHERE ${Query.join(orConstraints, " OR ")}`;
    assert.equal("SELECT * FROM Accounts WHERE ID == @p0 OR ID == @p1", final.toString());

    const rn = "D" + Date.now();
    const create = Query.create `CREATE Database ${Query.literal(rn)}`;
    assert.equal(`CREATE Database ${rn}`, create.toString());


}
