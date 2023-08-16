import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const headphone = await context.products
        .where({ name: "Jabber Head Phones" }, (p) => (x) => x.name === p.name)
        .include((x) => x.categories.forEach((c) => c.category.children))
        .first();

    assert.notEqual(null, headphone);

    const child = headphone.categories[0].category.children[0];
    assert.notEqual(null, child);

}
