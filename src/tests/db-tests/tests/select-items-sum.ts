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

    // const user = await context.users.all()
    // .where({}, (p) => (x) => x.orders.some((oi) => oi.customerID  > 0))
    // .trace(console.log)
    // .first();

    // assert.notEqual(null, user);

    // report  = await context.users.all()
    //     // .where({}, (p) => (x) => x.orders.some((oi) => oi.customerID  > 0))
    //     .map({}, (p) => (x) => ({
    //             total: 5 * Sql.coll.sum(x.orders.map((o) => Sql.coll.sum(o.orderItems.map((oi) => oi.amount))))
    //         })
    //     )
    //     .trace(console.log)
    //     .first();

    // assert.notEqual(null, report);

    // await context.orders.asQuery()
    //     .update(void 0, (p) => (x) => ({
    //         total: Sql.coll.sum(x.orderItems.map((o) => o.amount ))
    //     }));

    report = await context.users.all()
        .map({}, (p) => (x) => ({
                total: Sql.coll.sum(x.orders
                    .filter((o) => o.status === "pending")
                    .map((o) => o.total))
            })
        )
        .trace(console.log)
        .first();

    assert.notEqual(null, report);

    // const all = await context.orders.asQuery().map(void 0, (p) => (x) => x.total)
    //     .first();

    // assert.notEqual(null, all);

    // const r = await context.users.all()
    //     .trace(console.log)
    //     .sum(void 0, (p) => (x) => ({
    //         paid: x.orders.some((o) => o.status === "pending") ? 1 : 0,
    //         total: 1
    //     }));

    // assert.notEqual(r.paid, undefined);
    // assert.notEqual(r.total, undefined);
}
