import assert from "assert";
import Logger from "../../../common/Logger.js";
import { ServiceCollection, ServiceProvider } from "../../../di/di.js";
import { BaseDriver } from "../../../drivers/base/BaseDriver.js";
import ContextEvents from "../../../model/events/ContextEvents.js";
import { TestConfig } from "../../TestConfig.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import { createContext } from "../../model/createContext.js";
import { ShoppingContextEvents } from "../ShoppingContextEvents.js";
import { UserInfo } from "../events/UserInfo.js";

export default async function (this: TestConfig) {

    await createContext(this.driver);


    const global = new ServiceProvider();
    global.add(BaseDriver, this.driver);
    const scope = global.createScope();

    try {

        const userID = 1;
        const user = new UserInfo();
        user.userID = userID;
        scope.add(Logger, Logger.instance);
        scope.add(BaseDriver, this.driver);
        scope.add(UserInfo, user);
        scope.add(ContextEvents, new ShoppingContextEvents());
        const context = scope.create(ShoppingContext);

        const first = await context.products.all().first();
        first.name = "First Product";
        const fe = context.changeSet.getEntry(first);
        await context.saveChanges();

        assert.notStrictEqual(undefined, first.nameUpdated);
        assert.equal(true, first.nameUpdated);
        assert.equal(false, fe.isUpdated("name"));
    } finally {
        scope.dispose();
    }

}
