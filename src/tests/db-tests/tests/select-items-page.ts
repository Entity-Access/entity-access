import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const headphone = await context.products.where({ name: "Jabber Head Phones" }, (x, p) => x.name === p.name).first();

    assert.notEqual(null, headphone);

    const q = context.products.where({}, (x, p) => x.productID > 0)
        .orderBy({}, (x, p) => x.name);

    let products = await q
        .toPage(2,2);

    assert.equal(2, products.items.length);
    assert.equal(true, products.more);

    let i = 100;
    let more = true;
    let start = 0;
    while(more) {
        products = await q.toPage(start, 2);
        start += 2;
        i--;
        if(i === 0) {
            assert.fail();
            return;
        }
        more = products.more;
    }

}
