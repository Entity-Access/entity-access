import { readdir } from "fs/promises";
import { join } from "path";

const start = "./dist/tests";

/**
 * @type Array<{ name: string, error: string }>
 */
const results = [];

/**
 * 
 * @param {string} name
 */
async function runTest(name) {
    let exports = await import(name);
    exports = exports.default ?? exports;
    try {

        let r = exports();
        if (r?.then) {
            await r;
        }
        results.push({ name });
    } catch (error) {
        results.unshift({ name, error });
    }
}

async function runAll(dir) {
    const items = await readdir(dir, { withFileTypes: true });
    const tasks = [];
    for (const iterator of items) {
        const next = dir + "/" +  iterator.name;
        if (iterator.isDirectory()) {
            tasks.push(runAll(next));
            continue;
        }
        if (iterator.name.endsWith(".js")) {
            tasks.push(runTest(next));
        }
    }
    await Promise.all(tasks);
}

await runAll(start);

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

process.exit(exitCode);;
