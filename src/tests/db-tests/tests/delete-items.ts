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

    let total = await context.products.all().count();

    let n = await context.products.all()
        .delete(void 0, (p) => (x) => x.productID === 1);

    assert.equal(n, 1);

    let after = await context.products.all().count();

    assert.equal(total - 1, after);

    total = await context.products.all().count();
    n = await context.products.all()
        .limit(1)
        .delete(void 0, (p) => (x) => true === true);

    assert.equal(n, 1);

    after = await context.products.all().count();

    assert.equal(total - 1, after);

}
