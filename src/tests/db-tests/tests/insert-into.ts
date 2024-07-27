import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";
import Sql from "../../../sql/Sql.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    await context.messages.asQuery()
        .where(void 0, (p) => (x) => x.messageID > 100)
        .select(void 0, (p) => (x) => ({
            fromID: x.fromID,
            toID: x.toID,
            message: x.message
        }))
        .trace(console.log)
        .insertInTo(context.archivedMessages);

}
