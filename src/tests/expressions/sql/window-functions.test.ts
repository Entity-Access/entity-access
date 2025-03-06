import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";
import Sql from "../../../sql/Sql.js";

export default function () {

    const compiler = QueryCompiler.instance;

    const names = ["Akash", "Simmi"];

    let r = compiler.execute({ names }, (p) => (x) => Sql.window.rank.orderBy(x.marks));
    assert.equal("RANK() OVER (ORDER BY x.marks)", r.text);

    r = compiler.execute({ names }, (p) => (x) => Sql.window.rank.partitionByOrderBy(x.classRoom, x.marks));
    assert.equal("RANK() OVER (PARTITION BY x.classRoom ORDER BY x.marks)", r.text);

    r = compiler.execute({ names }, (p) => (x) => Sql.window.denseRank.orderBy(x.marks));
    assert.equal("DENSE_RANK() OVER (ORDER BY x.marks)", r.text);

    r = compiler.execute({ names }, (p) => (x) => Sql.window.denseRank.partitionByOrderBy(x.classRoom, x.marks));
    assert.equal("DENSE_RANK() OVER (PARTITION BY x.classRoom ORDER BY x.marks)", r.text);

    r = compiler.execute({ names }, (p) => (x) => Sql.window.rowNumber.orderBy(x.marks));
    assert.equal("ROW_NUMBER() OVER (ORDER BY x.marks)", r.text);

    r = compiler.execute({ names }, (p) => (x) => Sql.window.rowNumber.partitionByOrderBy(x.classRoom, x.marks));
    assert.equal("ROW_NUMBER() OVER (PARTITION BY x.classRoom ORDER BY x.marks)", r.text);

}

