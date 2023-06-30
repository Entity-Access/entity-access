import { Query } from "../../query/Query.js";
import { Order, ShoppingContext } from "./ShoppingContext.js";

export default async function() {

    const rn = "d" + Date.now();

    const context = new ShoppingContext(rn);

    await context.driver.ensureDatabase();

    await context.driver.automaticMigrations().migrate(context);

    const product = context.products.add({
        name: "Umbrella"
    });

    context.users.add({
        userID: Date.now().toString(),
        orders: [
            context.orders.add({
                orderDate: new Date(),
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
