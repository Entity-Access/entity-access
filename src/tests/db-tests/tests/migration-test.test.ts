/* eslint-disable no-console */
import assert from "assert";
import { BaseDriver } from "../../../drivers/base/BaseDriver.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import { TestConfig } from "../../TestConfig.js";
import Logger from "../../../common/Logger.js";

export default async function (this: TestConfig) {

    await migrate.call(this, "v1");
    let fail = false;

    const nullLogger = new Logger();
    nullLogger.log = (a) => (fail = /create|alter/i.test(a),
        fail
            ? console.log(a)
            : void 0,
        nullLogger);

    await migrate.call(this, "v2", nullLogger);
    assert(!fail);
}

async function migrate(this: TestConfig, version: string, log: Logger = null) {
    const { driver } = this;

    const copy = { ...driver } as BaseDriver;
    (copy as any).connectionString = { ...driver.connectionString };
    Object.setPrototypeOf(copy, Object.getPrototypeOf(driver));
    const context = new ShoppingContext(copy);

    await context.connection.ensureDatabase();

    return await context.connection.automaticMigrations(context).migrate({ log });
}
