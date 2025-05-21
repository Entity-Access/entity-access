import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    let c = await context.cachedItems.statements.insert({ key: "1", data: "b"});

    assert.equal(c.key, "1");

    c = await context.cachedItems.where(c, (p) => (x) => x.key === p.key).first();
    assert.equal(c.key, "1");
}
