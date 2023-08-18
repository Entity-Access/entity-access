import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    let headphone = await context.products
        .where({ name: "Jabber Head Phones" }, (p) => (x) => x.name === p.name)
        .include((x) => x.categories.forEach((c) => c.category.children))
        .first();

    assert.notEqual(null, headphone);

    let child = headphone.categories[0].category.children[0];
    assert.notEqual(null, child);

    // select nested with filter

    const blueTooth = "Bluetooth";
    headphone = await context.products
    .where({ name: "Jabber Head Phones", blueTooth }, (p) => (x) => x.name === p.name
        && x.categories.some((c) =>
            c.category.children.some((cc) => cc.name === p.blueTooth)))
    .include((x) => x.categories.forEach((c) => c.category.children))
    .first();

    child = headphone.categories[0].category.children[0];
    assert.notEqual(null, child);

}
