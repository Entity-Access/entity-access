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

    const key = IdentityService.getIdentity(context.model.getEntityType(User), { userID: 1 });
    const notFound = context.changeSet.getByIdentity(key);

    assert.equal(undefined, notFound);

    const found = await context.users.loadByKeys({ userID: 1});

    assert.notEqual(undefined, found);
}
