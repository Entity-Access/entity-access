import assert from "assert";
import Sql from "../../../sql/Sql.js";
import QueryCompiler from "../../../compiler/QueryCompiler.js";
import SqlServerQueryCompiler from "../../../drivers/sql-server/SqlServerQueryCompiler.js";

export default function () {

    const compiler = new SqlServerQueryCompiler();

    const names = ["Akash", "Simmi"];

    let r = compiler.execute({ names }, (x, p) => Sql.in(x.firstName, p.names));
    assert.equal(`x.[firstName] IN ($1,$2)`, r.text);

    r = compiler.execute({ names }, (x, p) => x.firstName in p.names);
    assert.equal(`x.[firstName] IN ($1,$2)`, r.text);

    r = compiler.execute({ names }, (x, p) => x.firstName in ["a", "b"]);
    assert.equal(`x.[firstName] IN (N'a',N'b')`, r.text);

    r = compiler.execute({ names }, (x, p) => Sql.text.likeAny(x.firstName, p.names));
    assert.equal(`((x.[firstName] LIKE $1) OR (x.[firstName] LIKE $2))`, r.text);

    r = compiler.execute({ names }, (x, p) => Sql.text.iLikeAny(x.firstName, p.names));
    assert.equal(`((x.[firstName] like $1) OR (x.[firstName] like $2))`, r.text);

    r = compiler.execute({ names: [] }, (x, p) => Sql.text.iLikeAny(x.firstName, p.names));
    assert.equal(` false `, r.text);
}

