import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";
import { ShoppingContext } from "../../model1/ShoppingContext.js";

export default function() {

    const context = new ShoppingContext();
    let query = context.products.where({ productID: 1 }, (p) => (x) => x.orderItems.some((o) => o.productID === p.productID));

    let r = query.toQuery();
    assert.equal(`EXISTS (SELECT $1 AS "o1" FROM "OrderItems" AS "o" WHERE ("o"."productID" = $2))`, r.text);

    query = query.where({ amount: 200}, (p) => (x) => x.orderItems.some((o) => o.amount > p.amount));
    r = query.toQuery();
    assert.equal(`(EXISTS (SELECT $1 AS "o1" FROM "OrderItems" AS "o" WHERE ("o"."productID" = $2)) AND EXISTS (SELECT $3 AS "o1" FROM "OrderItems" AS "o" WHERE ("o"."amount" > $4)))`
        ,r.text);
}
