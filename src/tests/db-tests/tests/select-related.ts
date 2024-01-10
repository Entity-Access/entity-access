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

    const headphone = await context.categories.where({ name: "head-phones/blue-tooth" }, (p) => (x) => x.categoryID === p.name).first();

    assert.equal(undefined, headphone.parent);

    await context.changeSet.getEntry(headphone).loadNavigationAsync((x) => x.parent);

    assert.notEqual(undefined, headphone.parent);

    context.changeSet.clear();

    const { parent } = headphone;
    const parentEntity = await context.categories.loadByKeys(parent);

    assert.equal(undefined, parentEntity.children);

    await context.changeSet.getEntry(parentEntity).loadNavigationAsync((x) => x.children);

    assert.notEqual(undefined, parentEntity.children);
}
