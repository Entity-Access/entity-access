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

    const pq = context.productCategories.where({ headPhoneCategory }, (p) => (x) => x.categoryID === p.headPhoneCategory);

    const products = context.products.asQuery()
        .innerJoin(pq, (p) => (x) => x.productID === p.productID && x.owner.orders.some((o) => o.orderID > 0));

    const n = await products.count();
    assert(n > 0);
}
