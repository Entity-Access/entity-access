import { createWriteStream, read, readFileSync } from "fs";
import JsonGenerator from "../../common/JsonGenerator.js";
import { pipeline } from "stream/promises";
import { readFile, writeFile } from "fs/promises";
import assert from "assert";

export default async function () {

    const model = {
        total: 1,
        items: [
            { a: 1},
            { b: 2},
            {
                c: {
                    d: 1
                }
            }
        ]
    };

    await verifyJson(model);

    await verifyJson({});

    await verifyJson([]);

    await verifyJson(null);

    await verifyJson(1);

    await verifyJson(new Date());

    await verifyJson("a");

}

async function verifyJson(model) {
    const readable = new JsonGenerator();

    const fileName = `./dist/${Date.now()}.json`;

    await writeFile(fileName, readable.reader(model));
    const text = await readFile(fileName, "utf-8");

    const m1 = JSON.stringify(model);
    const m2 = JSON.stringify(removeID(JSON.parse(text)));

    assert.equal(m1, m2);
}

function removeID(a) {
    if (!a) {
        return a;
    }
    if (Array.isArray(a)) {
        for (const element of a) {
            removeID(element);
        }
        return a;
    }
    if (typeof a === "object") {
        if (a instanceof Date) {
            return a;
        }
        if (!a) {
            return a;
        }
        delete a.$id;
        delete a.$ref;
        for (const key in a) {
            if (Object.prototype.hasOwnProperty.call(a, key)) {
                const element = a[key];
                removeID(element);
            }
        }
    }
    return a;
}