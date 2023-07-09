import { ServiceProvider } from "../../../di/di.js";
import { BaseDriver } from "../../../drivers/base/BaseDriver.js";
import { TestConfig } from "../../TestConfig.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";

export default async function(this: TestConfig) {

    const customer = await createUser(this);

    const scope = ServiceProvider.global.createScope();
    try {

        scope.add(BaseDriver, this.driver);
        const context = scope.create(ShoppingContext);

        // get first headphone...
        const headPhone = await context.products.all().firstOrFail();
        const headPhonePrice = await context.productPrices.where({ id: headPhone.productID }, (p) => (x) => x.productID === p.id).firstOrFail();

        context.orders.add({
            customer,
            orderDate: new Date(),
            orderItems: [
                context.orderItems.add({
                    product: headPhone,
                    productPrice: headPhonePrice
                })
            ]
        });

        await context.saveChanges();

    } finally {
        scope.dispose();
    }
}


async function createUser(config: TestConfig) {
    const context = new ShoppingContext(config.driver);
    const user = context.users.add({
        dateCreated: new Date()
    });
    await context.saveChanges();
    return user;
}

