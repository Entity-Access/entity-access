import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import { assertSqlMatch, trimInternal } from "../trimInternal.js";
import PostgreSqlDriver from "../../../drivers/postgres/PostgreSqlDriver.js";

const sql1 = `SELECT
p1."product_id",
p1."name",
p1."owner_id",
p1."status",
p1."product_description"
FROM products AS p1
WHERE EXISTS (SELECT
1
FROM order_items AS o
WHERE (o."product_id" = $1) AND (p1."product_id" = o."product_id"))`;

const sql2 = `SELECT
p1."product_id",
p1."name",
p1."owner_id",
p1."status",
p1."product_description"
FROM products AS p1
WHERE EXISTS (SELECT
1
FROM order_items AS o
WHERE (o."product_id" = $1) AND (p1."product_id" = o."product_id")) AND EXISTS (SELECT
1
FROM order_items AS o1
WHERE (o1."amount" > $2) AND (p1."product_id" = o1."product_id"))`;

const sql3 = `SELECT
p1."product_id",
p1."name",
p1."owner_id",
p1."status",
p1."product_description"
FROM products AS p1
WHERE EXISTS (SELECT
1
FROM order_items AS o
WHERE (o."product_id" = $1) AND (p1."product_id" = o."product_id")) AND EXISTS (SELECT
1
FROM order_items AS o1
 INNER JOIN orders AS o2 ON o1."order_id" = o2."order_id"
WHERE (o2."order_date" > $2) AND (p1."product_id" = o1."product_id"))`;

const productJoin = `SELECT
p1."product_id",
p1."name",
p1."owner_id",
p1."status",
p1."product_description"
FROM products AS p1
 LEFT JOIN users AS u ON p1."owner_id" = u."user_id"
WHERE u."date_created" > $1`;


const join2 = `SELECT
o1."order_item_id",
o1."order_id",
o1."product_id",
o1."price_id",
o1."amount"
FROM order_items AS o1
 LEFT JOIN products AS p ON o1."product_id" = p."product_id"
WHERE (o1."product_id" = $1) OR (p."owner_id" = $2)`;

const notExp = `SELECT
p1."product_id",
p1."name",
p1."owner_id",
p1."status",
p1."product_description"
FROM products AS p1
WHERE EXISTS
    (SELECT 1 FROM order_items AS o
        WHERE (o."product_id" = $1) AND (p1."product_id" = o."product_id")) AND
        NOT (EXISTS (SELECT 1 FROM order_items AS o1
                INNER JOIN orders AS o2 ON o1."order_id" = o2."order_id"
                    WHERE (o2."order_date" > $2) AND (p1."product_id" = o1."product_id")))
`;

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

    query = old.where({ date: new Date()}, (p) => (x) => !x.orderItems.some((o) => o.order.orderDate > p.date));
    r = query.toQuery();
    assertSqlMatch(notExp, r.text);

    query = old.selectView(void 0, (p) => (x) => ({
        productDescription: x.productDescription,
        ownerID: 0,
    }));
    r = query.toQuery();
    assertSqlMatch(`SELECT
    s."product_description",
    s."owner_id"
    FROM (SELECT
    p1."product_description",
    p1."owner_id"
    FROM products AS p1
WHERE EXISTS (SELECT
    1
    FROM order_items AS o
WHERE (o."product_id" = $1) AND (p1."product_id" = o."product_id"))) AS s`, r.text);
}
