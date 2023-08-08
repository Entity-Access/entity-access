import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const count = await context.users.all()
        .where({} , (p) => (x) => x.profile.photos.some((a) => true))
        .count();

    assert.equal(0, count);
}
