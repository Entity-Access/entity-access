/* eslint-disable no-console */
import assert from "assert";
import PostgreSqlDriver from "../../../drivers/postgres/PostgreSqlDriver.js";
import { Query } from "../../../query/Query.js";
import { TestConfig } from "../../TestConfig.js";
import DateTime from "../../../types/DateTime.js";

export default async function (this: TestConfig) {

    if(!this.db) {
        return;
    }

    const connection = this.driver.newConnection();

    if (!(this.driver instanceof PostgreSqlDriver)) {
        return;
    }

    await connection.ensureDatabase();
    // create table...
    await connection.executeQuery(`SELECT 1;`);

    // select items...
    await using items = await connection.executeReader(`SELECT * FROM (VALUES (1, 1), (1, 1)) as V(ID, Value)`);

    for await (const iterator of items.next(100)) {
        console.log(iterator);
    }

    const { rows: [ { now }] } = await connection.executeQuery(`SELECT NOW() as "now"`);

    assert(now instanceof DateTime);
    assert(now instanceof Date);

    const { rows: [ { nullDate }] } = await connection.executeQuery({ text: `SELECT $1::timestamp as "nullDate"`, values: [null] });

    assert(nullDate === null);
}