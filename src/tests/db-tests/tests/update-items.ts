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

    await context.saveChanges();


    await context.products
        .where(void 0, (p) => (x) => x.productID > 1)
        .update(void 0, (p) => (x) => ({
            productDescription: "updated"
        }));

    // we must verify that productID's description should not have changed...
    const p1 = await context.products.where(void 0, (p) => (x) => x.productID === 1).first();
    assert.notStrictEqual("updated", p1.productDescription);
}
