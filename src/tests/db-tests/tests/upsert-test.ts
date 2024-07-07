import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    let changes = { address: "e@e.com"};
    let keys = { ... changes };

    let e = await context.emailAddresses.statements.upsert(changes, void 0, keys);
    assert.strictEqual("1", e.id);
    e = await context.emailAddresses.statements.upsert(changes, void 0, keys);
    assert.strictEqual("1", e.id);

    e = await context.emailAddresses.statements.upsert(
        { ... changes, name: "a" },
        void 0,
        {
            id: e.id
        }
    );
    assert.strictEqual("1", e.id);

    e = await context.emailAddresses.statements.selectOrInsert(
        { ... changes },
        {
            id: e.id
        }
    );
    assert.strictEqual("1", e.id);
    assert.strictEqual("a", e.name);

    changes = { address: "a@e.com"};
    keys = { ... changes };
    e = await context.emailAddresses.statements.selectOrInsert(changes, keys);
    assert.strictEqual("2", e.id);

    e = await context.emailAddresses.statements.selectOrInsert(changes, keys);
    assert.strictEqual("2", e.id);

    await context.saveChanges();
}
