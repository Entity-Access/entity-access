import assert from "assert";
import Logger from "../../../common/Logger.js";
import { ServiceCollection, ServiceProvider } from "../../../di/di.js";
import { BaseDriver } from "../../../drivers/base/BaseDriver.js";
import ContextEvents from "../../../model/events/ContextEvents.js";
import { TestConfig } from "../../TestConfig.js";
import { ShoppingContext, statusPublished } from "../../model/ShoppingContext.js";
import { createContext } from "../../model/createContext.js";
import { ShoppingContextEvents } from "../ShoppingContextEvents.js";
import { UserInfo } from "../events/UserInfo.js";

export default async function (this: TestConfig) {

    await createContext(this.driver);


    const global = new ServiceProvider();
    global.add(BaseDriver, this.driver);

    using scope = global.createScope();

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

    const status = statusPublished;
    // create new product...
    const p = context.products.add({
        name: "A",
        status,
        ownerID: userID
    });
    assert.equal(void 0, p.afterInsertInvoked);
    await context.saveChanges();
    assert.equal(true, p.afterInsertInvoked);

    await context.userFiles.filtered("read").where({}, (_) => (x) => x.photoUsers.some((p1) => true === true))
        .include((x) => x.user.profile).toArray();


}
