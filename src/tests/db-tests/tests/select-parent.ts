import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";
import Sql from "../../../sql/Sql.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const cats = await context.categories.where({ search: "headphones%"}, (p) => (x) => Sql.text.like(x.parent.lowerName, p.search)
        || Sql.text.like(x.parent.parent.lowerName, p.search) )
        .trace(console.log)
        .toArray();

    // assert.equal("Bluetooth", cat1.name);
    assert.equal(2, cats.length);

    // select nested with filter


}
