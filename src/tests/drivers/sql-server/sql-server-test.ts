import assert from "assert";
import { SqlServerLiteral } from "../../../drivers/sql-server/SqlServerLiteral.js";

export default function () {

    assert.equal("N'A\\'B'", SqlServerLiteral.escapeLiteral("A'B") );

}
