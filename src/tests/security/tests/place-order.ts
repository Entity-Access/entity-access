import { ServiceProvider } from "../../../di/di.js";
import { BaseDriver } from "../../../drivers/base/BaseDriver.js";
import ContextEvents from "../../../model/events/ContextEvents.js";
import { TestConfig } from "../../TestConfig.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import { createContext } from "../../model/createContext.js";
import { ShoppingContextEvents } from "../ShoppingContextEvents.js";
import { UserInfo } from "../events/UserInfo.js";

export default async function(this: TestConfig) {

    const customer = await createUser(this);

    const scope = ServiceProvider.global.createScope();
    try {
        const user = new UserInfo();
        user.userID = customer.userID;
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

