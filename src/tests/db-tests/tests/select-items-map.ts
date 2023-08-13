import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const sum = await context.orderItems.all()
        .where({}, (p) => (x) => x.order.orderID > 0)
        .map({}, (p) => ({ amount }) => amount)
        .sum();

    assert.notEqual(0, sum);

}
