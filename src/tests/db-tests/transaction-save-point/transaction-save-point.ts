import assert from "assert";
import { Sql } from "../../../index.js";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";
import { traceSymbol } from "../../../common/symbols/symbols.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    context[traceSymbol] = console.log;

    await testSavePoint(context);

    // SQL SERVER doesn't worry about failed transactions
    // await failSavePoint(context);
}

async function testSavePoint(context: ShoppingContext) {
    await using tx = await context.connection.createTransaction();
    await tx.save("t1");

    await assert.rejects(async () => {
        const rx = await context.connection.executeQuery("SELECT ADSFDFDFDS FROM A1");
        console.log(rx);
    });

    await tx.rollbackTo("t1");
    const result = await context.connection.executeQuery("SELECT 1 as v1");
    assert.strictEqual(1, result.rows[0].v1);
}

async function failSavePoint(context: ShoppingContext) {
    await using tx = await context.connection.createTransaction();

    await assert.rejects(async () => {
        const rx = await context.connection.executeQuery("SELECT ADSFDFDFDS FROM A1");
        console.log(rx);
    });

    await assert.rejects(async () => await context.connection.executeQuery("SELECT 1 as v1"));
}

