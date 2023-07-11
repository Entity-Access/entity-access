import assert from "assert";
import Logger from "../../../common/Logger.js";
import { ServiceProvider } from "../../../di/di.js";
import { BaseDriver } from "../../../drivers/base/BaseDriver.js";
import ContextEvents from "../../../model/events/ContextEvents.js";
import { TestConfig } from "../../TestConfig.js";
import { ShoppingContext, User } from "../../model/ShoppingContext.js";
import { createContext } from "../../model/createContext.js";
import { ShoppingContextEvents } from "../ShoppingContextEvents.js";
import { UserInfo } from "../events/UserInfo.js";

export default async function(this: TestConfig) {

    const customer = await createUser(this);

    await addNewOrder.call(this, customer);

    try {
        await addNewOrder.call(this, customer, 1);
        assert.fail("No error thrown");
    } catch(error) {

    }

    await getNewOrders.call(this);

}

async function getNewOrders(this: TestConfig) {
    const scope = ServiceProvider.global.createScope();
    try {
        const user = new UserInfo();
        user.userID = 2;
        scope.add(Logger, Logger.instance);
        scope.add(BaseDriver, this.driver);
        scope.add(UserInfo, user);
        scope.add(ContextEvents, new ShoppingContextEvents());
        const context = scope.create(ShoppingContext);
        context.verifyFilters = true;

        const order = await context.orders.all().first();

        const q = context.orders.all()
            .include((x) => x.orderItems)
                .thenInclude((x) => x.productPrice.product)
            .include((x) => x.customer);

        order.orderDate = new Date();
        await context.saveChanges();

    } finally {
        scope.dispose();
    }
}

async function addNewOrder(this: TestConfig, customer: User, userID?) {
    const scope = ServiceProvider.global.createScope();
    try {
        const user = new UserInfo();
        user.userID = userID ?? customer.userID;
        scope.add(Logger, Logger.instance);
        scope.add(BaseDriver, this.driver);
        scope.add(UserInfo, user);
        scope.add(ContextEvents, new ShoppingContextEvents());
        const context = scope.create(ShoppingContext);
        context.verifyFilters = true;

        // get first headphone...
        const headPhone = await context.products.all().firstOrFail();
        const headPhonePrice = await context.productPrices.where({ id: headPhone.productID }, (p) => (x) => x.productID === p.id).firstOrFail();

        context.orders.add({
            customer,
            orderDate: new Date(),
            orderItems: [
                context.orderItems.add({
                    product: headPhone,
                    productPrice: headPhonePrice,
                    amount: headPhonePrice.amount,
                })
            ]
        });

        await context.saveChanges();

        // lets filter the orders

        const f = context.orders.filtered();
        const myOrders = await f.count();
        assert.equal(1, myOrders);

        const all = await context.orders.all().count();
        assert.notEqual(all, myOrders);

    } finally {
        scope.dispose();
    }
}

async function createUser(config: TestConfig) {
    const context = await createContext(config.driver);
    config.driver.connectionString.database = context.driver.connectionString.database;
    const user = context.users.add({
        dateCreated: new Date()
    });
    await context.saveChanges();
    return user;
}

