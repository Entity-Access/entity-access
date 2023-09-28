import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    let changes = { address: "e@e.com"};
    let test = { ... changes };

    let e = await context.emailAddresses.saveDirect({ mode: "upsert", changes, test});
    assert.strictEqual("1", e.id);
    e = await context.emailAddresses.saveDirect({ mode: "upsert", changes, test});
    assert.strictEqual("1", e.id);

    changes = { address: "a@e.com"};
    test = { ... changes };
    e = await context.emailAddresses.saveDirect({ mode: "selectOrInsert", changes, test});
    assert.strictEqual("2", e.id);

    e = await context.emailAddresses.saveDirect({ mode: "selectOrInsert", changes, test});
    assert.strictEqual("2", e.id);

    await context.saveChanges();
}
