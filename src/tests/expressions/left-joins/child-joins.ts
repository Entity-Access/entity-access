import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import { assertSqlMatch, trimInternal } from "../trimInternal.js";
import PostgreSqlDriver from "../../../drivers/postgres/PostgreSqlDriver.js";

const sql1 = `SELECT
    "P1"."productID",
    "P1"."name",
    "P1"."ownerID"
FROM "Products" AS "P1"
WHERE
    EXISTS (SELECT
                $1 AS "o1"
        FROM "OrderItems" AS "O0"
        WHERE (
            ("P1"."productID" = "O0"."productID")
            AND ("O0"."productID" = $2)
            )
        )`;

const sql2 = `SELECT
    "P1"."productID",
    "P1"."name",
    "P1"."ownerID"
FROM "Products" AS "P1"
    WHERE (EXISTS (SELECT
            $1 AS "o1"
        FROM "OrderItems" AS "O0"
        WHERE (("P1"."productID" = "O0"."productID") AND ("O0"."productID" = $2))) AND EXISTS (SELECT
            $3 AS "o1"
        FROM "OrderItems" AS "O1"
        WHERE (("P1"."productID" = "O1"."productID") AND ("O1"."amount" > $4))))
`;

const sql3 = `SELECT
"P1"."productID","P1"."name","P1"."ownerID"
FROM "Products" AS "P1"
WHERE (EXISTS (SELECT
$1 AS "o1"
FROM "OrderItems" AS "O0"
WHERE (("P1"."productID" = "O0"."productID") AND ("O0"."productID" = $2))) AND EXISTS (SELECT
$3 AS "o1"
FROM "OrderItems" AS "O1"
 INNER JOIN "Orders" AS "O2" ON ("O1"."orderID" = "O2"."orderID")
WHERE (("P1"."productID" = "O1"."productID") AND ("O2"."orderDate" > $4))))`;

const productJoin = `SELECT
"P1"."productID","P1"."name","P1"."ownerID"
FROM "Products" AS "P1"
 LEFT JOIN "Users" AS "U0" ON ("P1"."ownerID" = "U0"."userID")
WHERE ("U0"."dateCreated" > $1)`;

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
}
