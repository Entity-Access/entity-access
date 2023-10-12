import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";
import Sql from "../../../sql/Sql.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const f = await context.orderItems.all()
        .map({}, (p) => ({ orderID, amount }) => ({ orderID, amount }))
        .first();

    console.log(f);
}
