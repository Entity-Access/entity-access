import { readdir } from "fs/promises";
import PostgreSqlDriver from "./dist/drivers/postgres/PostgreSqlDriver.js";

/**
 * @type Array<{ name: string, error: string }>
 */
const results = [];


export default class TestRunner {

    static get drivers() {
        const database = "D" + Date.now();
        return [
            new PostgreSqlDriver({
                database,
                host: "localhost",
                user: "postgres",
                password: "abcd123",
                port: 5432
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


await TestRunner.runAll("./dist/tests", true);

let exitCode = 0;

for (const { error, name } of results) {
    if (error) {
        exitCode = 1;
        console.error(`${name} failed`);
        console.error(error?.stack ?? error);
        continue;
    }
    console.log(`${name} executed.`);
}

process.exit(exitCode);