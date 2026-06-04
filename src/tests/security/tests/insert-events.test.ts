import assert from "assert";
import Logger from "../../../common/Logger.js";
import { ServiceProvider } from "../../../di/di.js";
import { BaseDriver } from "../../../drivers/base/BaseDriver.js";
import ContextEvents from "../../../model/events/ContextEvents.js";
import { TestConfig } from "../../TestConfig.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import { createContext } from "../../model/createContext.js";
import { ShoppingContextEvents } from "../ShoppingContextEvents.js";
import { UserInfo } from "../events/UserInfo.js";
import DateTime from "../../../types/DateTime.js";

export default async function (this: TestConfig) {

    await createContext(this.driver);


    const global = new ServiceProvider();
    global.add(BaseDriver, this.driver);

    using scope = global.createScope();

    const userID = 1;
    const user = new UserInfo();
    user.userID = userID;
    scope.add(Logger, Logger.instance);
    scope.add(BaseDriver, this.driver);
    scope.add(UserInfo, user);
    scope.add(ContextEvents, new ShoppingContextEvents());
    const context = scope.create(ShoppingContext);
    scope.add(ShoppingContext, context);

    const start = DateTime.now;

    const order = context.orders.add({
        status: "a",
        orderDate: start.asJSDate,
        customerID: 1,
        orderItems: [
            context.orderItems.add({
                amount: 10,
            })
        ]
    });
    await context.saveChanges();

    const oi = order.orderItems[0];

    assert.equal(oi.priceID , oi.productPrice.priceID);


}
