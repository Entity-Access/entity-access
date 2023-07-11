import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import Logger from "../../../common/Logger.js";

export default async function (this: TestConfig) {

    const old = await createContext(this.driver);

    const context = new ShoppingContext(old.driver, void 0, Logger.instance);
    const order = await context.orders.all()
        .where({id: 0}, (p) => (x) => x.orderID > p.id)
        .include((x) => x.orderItems)
        .first();

    assert.notEqual(null, order);

}
