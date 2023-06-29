import { Query } from "../../query/Query.js";
import { ShoppingContext } from "./ShoppingContext.js";

export default async function() {

    const rn = "d" + Date.now();

    let c1 = new ShoppingContext("postgres");

    await c1.driver.executeNonQuery(`CREATE database ${Query.literal(rn)};`);

    const context = new ShoppingContext(rn);

    await context.driver.executeNonQuery(`
        CREATE TABLE IF NOT EXISTS "Products" (
            "productID" bigserial not null primary key,
            "name" text not null
        );
    `);

    context.products.add({
        name: "Umbrella"
    });

    await context.saveChanges();

}
