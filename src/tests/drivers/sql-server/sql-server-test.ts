import assert from "assert";
import SqlServerDriver from "../../../drivers/sql-server/SqlServerDriver.js";
import { SqlServerLiteral } from "../../../drivers/sql-server/SqlServerLiteral.js";

export default function () {

    assert.equal("'A\\'B'", SqlServerLiteral.escapeLiteral("A'B") );

}
