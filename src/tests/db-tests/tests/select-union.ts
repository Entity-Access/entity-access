import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory, maleClothesCategory } from "../../model/createContext.js";
import IdentityService from "../../../model/identity/IdentityService.js";
import { User } from "../../model/ShoppingContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    context.changeSet.clear();

    const pq = context.productCategories.where({ headPhoneCategory }, (p) => (x) => x.categoryID === p.headPhoneCategory);

    const r = pq
        .unionAll(context.productCategories.where({ maleClothesCategory }, (p) => (x) => x.category.parentID === p.maleClothesCategory))
        .trace(console.log);

    const n = await r.count();

    assert(n > 0);

}
