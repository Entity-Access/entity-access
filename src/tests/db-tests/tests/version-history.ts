import assert from "assert";
import { BaseDriver } from "../../../drivers/base/BaseDriver.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import { TestConfig } from "../../TestConfig.js";

export default async function (this: TestConfig) {

    assert.equal(true, await migrate.call(this));

    assert.equal(false, await migrate.call(this));
}

async function migrate(this: TestConfig) {
    const { driver } = this;

    const copy = { ...driver } as BaseDriver;
    (copy as any).connectionString = { ...driver.connectionString };
    Object.setPrototypeOf(copy, Object.getPrototypeOf(driver));
    const context = new ShoppingContext(copy);

    await context.connection.ensureDatabase();

    return await context.connection.automaticMigrations(context).migrate({ log: null, version: "v1" });
}
