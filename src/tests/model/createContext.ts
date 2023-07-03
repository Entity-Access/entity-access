import { IClassOf } from "../../decorators/IClassOf.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
import { ShoppingContext } from "./ShoppingContext.js";

export async function createContext(driver: BaseDriver) {

    const rn = "d" + Date.now();
    const copy = { ... driver } as BaseDriver;
    (copy as any).connectionString = { ... driver.connectionString };
    copy.connectionString.database = rn;
    Object.setPrototypeOf(copy, Object.getPrototypeOf(driver));
    const context = new ShoppingContext(copy);

    await context.driver.ensureDatabase();

    await context.driver.automaticMigrations().migrate(context);

    await seed(context);

    return context;

}

// export default function () {

// }

async function seed(context: ShoppingContext) {
    const now = new Date();
    context.products.add({
        name: "Pillow",
        prices: [
            context.productPrices.add({
                active: true,
                startDate: now,
                amount: 100
            })
        ]
    });

    await context.saveChanges();
}

