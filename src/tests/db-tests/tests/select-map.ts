import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const f = await context.orderItems.all()
        .map(({ orderID, amount }) => ({ orderID, amount }))
        .first();

    console.log(f);
}
