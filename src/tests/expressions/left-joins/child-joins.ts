import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import { assertSqlMatch, trimInternal } from "../trimInternal.js";
import PostgreSqlDriver from "../../../drivers/postgres/PostgreSqlDriver.js";

const sql1 = `SELECT
"p1"."productID",
"p1"."name",
"p1"."ownerID",
"p1"."status"
FROM "Products" AS "p1"
WHERE EXISTS (SELECT
1
FROM "OrderItems" AS "o"
WHERE ("p1"."productID" = "o"."productID") AND ("o"."productID" = $1))`;

const sql2 = `SELECT
"p1"."productID",
"p1"."name",
"p1"."ownerID",
"p1"."status"
FROM "Products" AS "p1"
WHERE EXISTS (SELECT
1
FROM "OrderItems" AS "o"
WHERE ("p1"."productID" = "o"."productID") AND ("o"."productID" = $1)) AND EXISTS (SELECT
1
FROM "OrderItems" AS "o1"
WHERE ("p1"."productID" = "o1"."productID") AND ("o1"."amount" > $2))`;

const sql3 = `SELECT
"p1"."productID",
"p1"."name",
"p1"."ownerID",
"p1"."status"
FROM "Products" AS "p1"
WHERE EXISTS (SELECT
1
FROM "OrderItems" AS "o"
WHERE ("p1"."productID" = "o"."productID") AND ("o"."productID" = $1)) AND EXISTS (SELECT
1
FROM "OrderItems" AS "o1"
 INNER JOIN "Orders" AS "o2" ON "o1"."orderID" = "o2"."orderID"
WHERE ("p1"."productID" = "o1"."productID") AND ("o2"."orderDate" > $2))`;

const productJoin = `SELECT
"p1"."productID",
"p1"."name",
"p1"."ownerID",
"p1"."status"
FROM "Products" AS "p1"
 LEFT JOIN "Users" AS "u" ON "p1"."ownerID" = "u"."userID"
WHERE "u"."dateCreated" > $1`;


const join2 = `SELECT
"o1"."orderItemID",
"o1"."orderID",
"o1"."productID",
"o1"."priceID",
"o1"."amount"
FROM "OrderItems" AS "o1"
 INNER JOIN "Products" AS "p" ON "o1"."productID" = "p"."productID"
WHERE ("o1"."productID" = $1) OR ("p"."ownerID" = $2)`;

export default function() {

    const context = new ShoppingContext(new PostgreSqlDriver({}));
    let query = context.products.where({ productID: 1 }, (p) => (x) => x.orderItems.some((o) => o.productID === p.productID));

    let r = query.toQuery();
    assertSqlMatch(sql1, r.text);

    const old = query;
    query = query.where({ amount: 200}, (p) => (x) => x.orderItems.some((o) => o.amount > p.amount));
    r = query.toQuery();
    assertSqlMatch(sql2, r.text);

    query = old.where({ date: new Date()}, (p) => (x) => x.orderItems.some((o) => o.order.orderDate > p.date));
    r = query.toQuery();
    assertSqlMatch(sql3, r.text);

    query = context.products.where({ date: new Date()}, (p) => (x) => x.owner.dateCreated > p.date);
    r = query.toQuery();
    assertSqlMatch(productJoin, r.text);

    const q = context.orderItems.where({ o: 1,  owner: 1}, (p) => (x) => x.productID === p.o || x.product.ownerID === p.owner);
    r = q.toQuery();
    assertSqlMatch(join2, r.text);
}
