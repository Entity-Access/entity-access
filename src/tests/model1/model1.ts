import { Query } from "../../query/Query.js";
import { TestConfig } from "../TestConfig.js";
import { Order, ShoppingContext } from "./ShoppingContext.js";

export default async function() {

    if(!TestConfig.db) {
        return;
    }

    const rn = "d" + Date.now();

    const context = new ShoppingContext(rn);

    await context.driver.ensureDatabase();

    await context.driver.automaticMigrations().migrate(context);

    const product = context.products.add({
        name: "Umbrella"
    });

    const now = new Date();
    context.users.add({
        dateCreated: now,
        orders: [
            context.orders.add({
                orderDate: now,
                orderItems: [
                    context.orderItems.add({
                        product
                    })
                ]
            }),
        ]
    });

    await context.saveChanges();

}
