import { readdir } from "fs/promises";
import PostgreSqlDriver from "./dist/drivers/postgres/PostgreSqlDriver.js";
import SqlServerDriver from "./dist/drivers/sql-server/SqlServerDriver.js";
import * as ports from "tcp-port-used";

const host = process.env.POSTGRES_HOST ?? "localhost";
const postGresPort = Number(process.env.POSTGRES_PORT ?? 5432);

// if (process.argv.includes("test-db")) {
//     // wait for ports to open...
//     console.log("Waiting for port to be open");
//     await ports.waitUntilUsedOnHost(port, host, void 0, 15000);
// }

/**
 * @type Array<{ name: string, error: string }>
 */
const results = [];

let start = Date.now();

export default class TestRunner {

    static get drivers() {
        const database = "D" + start++;
        return [
            new PostgreSqlDriver({
                database,
                host,
                user: "postgres",
                password: "abcd123",
                port: postGresPort
            }),
            new SqlServerDriver({
                database,
                host,
                user: "sa",
                password: "$EntityAccess2023",
                port: 1433,
                options: {
                    encrypt: true, // for azure
                    trustServerCertificate: true // change to true for local dev / self-signed certs
                }
            })
        ];
    }

    /**
     * 
     * @param {string} name
     */
    static async runTest(name, thisParam) {
        const moduleExports = await import(name);
        const { default: d } = moduleExports;
        if (!d) {
            return;
        }
        try {

            const r = d.call(thisParam);
            if (r?.then) {
                await r;
            }
            results.push({ name });
        } catch (error) {
            results.unshift({ name, error });
        }
    }

    static async runAll(dir, db) {
        const items = await readdir(dir, { withFileTypes: true });
        const tasks = [];
        for (const iterator of items) {
            const next = dir + "/" +  iterator.name;
            if (iterator.isDirectory()) {
                tasks.push(this.runAll(next, db));
                continue;
            }
            if (iterator.name.endsWith(".js")) {
                for (const driver of this.drivers) {
                    tasks.push(this.runTest(next, { driver, db }));
                }
            }
        }
        await Promise.all(tasks);
    }

}

const testDb = !process.argv.includes("no-db");

await TestRunner.runAll("./dist/tests", testDb);

let exitCode = 0;
const failed = 0;

for (const { error, name } of results) {
    if (error) {
        exitCode = 1;
        failed++;
        console.error(`${name} failed`);
        console.error(error?.stack ?? error);
        continue;
    }
    console.log(`${name} executed.`);
}

if (exitCode === 0) {
    console.log(`${results.length} tests ran successfully.`);
} else {
    console.log(`${failed} Tests out of ${results.length} failed.`);
}

process.exit(exitCode);