import { ShoppingContext } from "./ShoppingContext.js";

export default async function() {

    const context = new ShoppingContext();

    context.products.add({
        name: "Umbrella"
    });

    await context.saveChanges();

}
