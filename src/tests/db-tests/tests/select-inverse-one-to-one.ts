import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";
import { ShoppingContextEvents } from "../../security/ShoppingContextEvents.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    // const count = await context.users.all()
    //     .where({} , (p) => (x) => x.profile.photos.some((a) => true) || x.profile.photos.some((a) => true))
    //     .count();

    // assert.equal(0, count);

    // include inverse...
    let all = await context.users.all()
        .where({} , (p) => (x) => x.profile.photos.some((a) => a.photoID > 0) || x.profile.photos.some((a) => a.photoID > 0))
        .include((x) => x.profile.photos)
        .first();

    assert.equal(null, all);

    all = await context.users.all()
        .where({} , (p) => (x) => x.files.some((a) => a.fileID > 0))
        .include((x) => x.files)
        .first();

    assert.equal(null, all);

    const c = await context.userFiles.where({}, (p) => (x) => x.user.userID > 0).count();
    assert.equal(0, c);

    await context.profilePhotos.all().include((x) => x.profile).toArray();
}
