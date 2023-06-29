import { Query } from "../../query/Query.js";
import { ShoppingContext } from "./ShoppingContext.js";

export default async function() {

    const rn = "d" + Date.now();

    const context = new ShoppingContext(rn);

    await context.driver.ensureDatabase();

    await context.driver.automaticMigrations().migrate(context);

    context.products.add({
        name: "Umbrella"
    });

    await context.saveChanges();

}
