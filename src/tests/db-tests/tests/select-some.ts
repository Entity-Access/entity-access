import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    context.changeSet.clear();

    let has = await context.products.asQuery()
        .where((x) => x.productID === 1223232)
        .some();

    assert(!has);

    has = await context.products.asQuery()
        .some();

    assert(has);
}
