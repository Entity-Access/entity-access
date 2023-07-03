/* eslint-disable no-console */
import PostgreSqlDriver from "../../../drivers/postgres/PostgreSqlDriver.js";
import { Query } from "../../../query/Query.js";
import { TestConfig } from "../../TestConfig.js";

export default async function (this: TestConfig) {

    if(!this.db) {
        return;
    }

    const connection = this.driver;

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