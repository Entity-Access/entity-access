import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    let e = await context.emailAddresses.saveDirect({ address: "e@e.com"}, "upsert", { address: "e@e.com"});
    assert.strictEqual("1", e.id);
    e = await context.emailAddresses.saveDirect({ address: "e@e.com"}, "upsert", { address: "e@e.com"});
    assert.strictEqual("1", e.id);
    await context.saveChanges();
}
