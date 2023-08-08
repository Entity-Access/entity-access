import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const category = await context.categories
        .where({ headPhoneCategory }, (p) => (x) => x.categoryID === p.headPhoneCategory && x.productCategories.some((pc) => pc.productID > 0))
        .include((x) => x.productCategories.forEach((pc) => pc.product.prices))
        .first();

    const first = category.productCategories[0];
    assert.notEqual(0, first.product.prices.length);

    const count = await context.categories
        .where({ headPhoneCategory }, (p) => (x) => x.categoryID === p.headPhoneCategory && x.productCategories.some((pc) => pc.productID > 0))
        .count();

    assert.notEqual(0, count);


}
