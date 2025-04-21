import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";
import IdentityService from "../../../model/identity/IdentityService.js";
import { User } from "../../model/ShoppingContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    context.changeSet.clear();

    const pq = context.productCategories.where({ headPhoneCategory }, (p) => (x) => x.categoryID === p.headPhoneCategory
        && x.category.productCategories.some((pc) => pc.productCategoryID > 0 && pc.product.categories.some((c) => c.productCategoryID > 0))
        );

    const products = context.products.asQuery()
        .exists(pq, (p) => (x) => x.productID === p.productID && x.categories.some((o) => o.productCategoryID > 0
            && x.categories.some((c) => c.categoryID !== null)
    ));

    const n = await products.trace(console.log).count();
    assert(n > 0);
}
