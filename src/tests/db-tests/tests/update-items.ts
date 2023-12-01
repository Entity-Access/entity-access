import { Sql } from "../../../index.js";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const first = await context.products.all().first();

    first.name = "First product";

    await context.saveChanges();


    await context.products
        .where(void 0, (p) => (x) => x.productID > 0)
        .trace(console.log)
        .update(void 0, (p) => (x) => ({
            productDescription: "updated"
        }));
}
