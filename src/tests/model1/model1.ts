import { Query } from "../../query/Query.js";
import { ShoppingContext } from "./ShoppingContext.js";

export default async function() {

    const rn = "d" + Date.now();

    const c1 = new ShoppingContext("postgres");

    await c1.driver.executeNonQuery(Query.create `
        CREATE database ${Query.literal(rn)};
    `);

    await c1.driver.executeNonQuery(Query.create `
        CREATE TABLE IF NOT EXISTS Products (
            "productID" bigserial not null primary key,
            "name" text not null
        );
    `);

    const context = new ShoppingContext(rn);

    context.products.add({
        name: "Umbrella"
    });

    await context.saveChanges();

}
