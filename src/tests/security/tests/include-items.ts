import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function (this: TestConfig) {

    const context = await createContext(this.driver);

    const order = await context.orders.all()
        .where({id: 0}, (p) => (x) => x.orderID > p.id)
        .include((x) => x.orderItems)
        .first();

    assert.notEqual(null, order);

}
