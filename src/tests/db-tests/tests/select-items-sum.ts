import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";
import Sql from "../../../sql/Sql.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    let report;
    // report  = await context.users.all()
    //     .where({}, (p) => (x) => x.orders.some((oi) => oi.customerID  > 0))
    //     .map({}, (p) => (x) => ({
    //             total: Sql.coll.sum(x.orders.map((o) => Sql.coll.sum(o.orderItems.map((oi) => oi.amount))))
    //         })
    //     )
    //     .trace(console.log)
    //     .first();

    // assert.notEqual(null, report);

    report = await context.users.all()
        .where({}, (p) => (x) => x.orders.some((oi) => oi.customerID  > 0))
        .map({}, (p) => (x) => ({
                total: Sql.coll.sum(x.orders
                    .filter((o) => o.status === "pending")
                    .map((o) => Sql.coll.sum(o.orderItems.map((oi) => oi.amount))))
            })
        )
        .trace(console.log)
        .first();

    assert.notEqual(null, report);
}
