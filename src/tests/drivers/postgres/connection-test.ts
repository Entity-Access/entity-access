/* eslint-disable no-console */
import PostgreSqlDriver from "../../../drivers/postgres/PostgreSqlDriver.js";
import { Query } from "../../../query/Query.js";
import { TestConfig } from "../../TestConfig.js";

export default async function () {

    if(!TestConfig.db) {
        return;
    }

    const connection = new PostgreSqlDriver({
        host: "localhost",
        port: 5432,
        user: "postgres",
        database: "postgres",
        password: "abcd123"
    });

    // create table...
    await connection.executeNonQuery(`SELECT 1;`);

    // select items...
    const items = await connection.executeReader(`SELECT * FROM (VALUES (1, 1), (1, 1)) as V(ID, Value)`);

    try {
        for await (const iterator of items.next(100)) {
            console.log(iterator);
        }
    } finally {
        await items.dispose();
    }

}