import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const headphone = await context.products.where({ name: "Jabber Head Phones" }, (p) => (x) => x.name === p.name).first();

    assert.notEqual(null, headphone);

    const products = await context.products.where({}, (p) => (x) => x.productID > 0)
        .offset(2)
        .limit(5)
        .orderBy({}, (p) => (x) => x.name)
        .toArray();

    assert.equal(5, products.length);

    const sorted = [ ... products].sort((a, b) => a.name.localeCompare(b.name));

    assert.equal(products.join(","), sorted.join(","));

    // count all headphones...
    let allHeadphones = await context.productCategories.where({ headPhoneCategory }, (p) => (x) => x.category.categoryID === p.headPhoneCategory).count();

    assert.equal(6, allHeadphones);

    allHeadphones = await context.products.where({ headPhoneCategory }, (p) => (x) => x.categories.some((pc) => pc.categoryID === p.headPhoneCategory)).count();

    assert.equal(6, allHeadphones);

    const first = await context.productCategories.where({ headPhoneCategory }, (p) => (x) => x.category.categoryID === p.headPhoneCategory).first();

    // delete first one...
    context.products.delete(first);

    await context.saveChanges();

    allHeadphones = await context.products.where({ headPhoneCategory }, (p) => (x) => x.categories.some((pc) => pc.categoryID === p.headPhoneCategory)).count();

    assert.equal(5, allHeadphones);

}
