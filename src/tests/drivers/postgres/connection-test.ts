import PostgreSqlDriver from "../../../drivers/postgres/PostgreSqlDriver.js";
import { Query } from "../../../query/Query.js";

export default async function () {

    const connection = new PostgreSqlDriver({
        host: "localhost",
        port: 5432,
        user: "postgres",
        password: "abcd123"
    });

    // create table...
    await connection.executeNonQuery(Query.create `SELECT 1;`);

    // select items...
    const items = await connection.executeReader(Query.create `SELECT * FROM (VALUES (1, 1), (1, 1)) as V(ID, Value)`);

    try { 
        for await (const iterator of items.next(100)) {
            console.log(iterator);
        }
    } finally {
        await items.dispose();
    }
    
}