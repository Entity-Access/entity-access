import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const headphone = await context.products.where({ name: "Jabber HeadPhones" }, (p) => (x) => x.name === p.name).first();

    assert.notEqual(null, headphone);


}
