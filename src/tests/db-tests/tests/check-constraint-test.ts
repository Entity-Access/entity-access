import assert from "assert";
import { Sql } from "../../../index.js";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const first = await context.products.all().first();

    first.name = "First product";

    try {

        // try direct save...
        await context.productPrices.saveDirect({
            mode: "insert",
            changes: {
                productID: first.productID,
                active: true,
                amount: -1,
                startDate: new Date(),
            }
        });
    } catch (error) {
        // expcted...
        return;
    }
    assert.fail();
}
