import assert from "assert";
import Logger from "../../../common/Logger.js";
import { ServiceCollection, ServiceProvider } from "../../../di/di.js";
import { BaseDriver } from "../../../drivers/base/BaseDriver.js";
import ContextEvents from "../../../model/events/ContextEvents.js";
import { TestConfig } from "../../TestConfig.js";
import { ShoppingContext, User } from "../../model/ShoppingContext.js";
import { createContext } from "../../model/createContext.js";
import { ShoppingContextEvents } from "../ShoppingContextEvents.js";
import { UserInfo } from "../events/UserInfo.js";
import DateTime from "../../../types/DateTime.js";

export default async function(this: TestConfig) {

    const customer = await createUser(this);

    await addNewOrder.call(this, customer);

    try {
        await addNewOrder.call(this, customer, 1);
        assert.fail("No error thrown");
    } catch(error) {

    }

    await getNewOrders.call(this);

    await createInterests.call(this);
}

async function createInterests(this: TestConfig) {
    const global = new ServiceProvider();
    global.add(BaseDriver, this.driver);
    const scope = global.createScope();
    try {
        const userID = 2;
        const user = new UserInfo();
        user.userID = userID;
        ServiceCollection.register("Singleton", Logger, () => Logger.instance);
        scope.add(BaseDriver, this.driver);
        scope.add(UserInfo, user);
        ServiceCollection.register("Singleton", ContextEvents, () => new ShoppingContextEvents());
        const context = scope.create(ShoppingContext);
        context.verifyFilters = false;
        context.raiseEvents = false;

        const headPhone = await context.products.all().include((x) => x.categories).firstOrFail();
        const category = headPhone.categories[0];

        context.userCategories.add({
            userID,
            categoryID: category.categoryID,
            lastUpdated: DateTime.utcNow
        });

        await context.saveChanges();

        const userCategories = await context.userCategories.where({ userID }, (p) => (x) => x.userID === p.userID).count();

        assert.equal(1, userCategories);

    } finally {
        scope.dispose();
    }
}

async function getNewOrders(this: TestConfig) {
    const global = new ServiceProvider();
    global.add(BaseDriver, this.driver);
    const scope = global.createScope();
    try {
        const user = new UserInfo();
        user.userID = 2;
        ServiceCollection.register("Singleton", Logger, () => Logger.instance);
        scope.add(BaseDriver, this.driver);
        scope.add(UserInfo, user);
        ServiceCollection.register("Singleton", ContextEvents, () => new ShoppingContextEvents());
        const context = scope.create(ShoppingContext);
        context.verifyFilters = true;

        const order = await context.orders.all().first();

        order.orderDate = new Date();
        await context.saveChanges();

    } finally {
        scope.dispose();
    }
}

async function addNewOrder(this: TestConfig, customer: User, userID?) {
    const global = new ServiceProvider();
    global.add(BaseDriver, this.driver);
    const scope = global.createScope();
    try {
        const user = new UserInfo();
        user.userID = userID ?? customer.userID;
        ServiceCollection.register("Singleton", Logger, () => Logger.instance);
        scope.add(BaseDriver, this.driver);
        scope.add(UserInfo, user);
        ServiceCollection.register("Singleton", ContextEvents, () => new ShoppingContextEvents());
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
    const user = context.users.add({
        userName: "customer",
        dateCreated: new Date()
    });
    await context.saveChanges();
    return { ... user };
}

