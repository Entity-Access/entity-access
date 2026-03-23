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

    let has = await context.products.asQuery()
        .where((x) => x.productID === 1223232)
        .some();

    assert(!has);

    has = await context.products.asQuery()
        .some();

    assert(has);
}
