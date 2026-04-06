import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext, headPhoneCategory } from "../../model/createContext.js";
import IdentityService from "../../../model/identity/IdentityService.js";
import { User } from "../../model/ShoppingContext.js";
import Sql from "../../../sql/Sql.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const first = await context.users.asQuery().first();

    const mumbai = { latitude: 19.076090, longitude: 72.877426, srid: 4326};

    await context.users.where(first, (x, p) => x.userID === p.userID)
        // .trace(console.log)
        .update({ mumbai}, (x, p) => ({
            location: Sql.spatial.location(p.mumbai)
        }));

    const pune = { latitude: 18.5246, longitude: 73.8786, srid: 4326};

    const near = await context.users
        .where(first, (x, p) => x.userID === p.userID)
        .map({ pune}, (x, p) => ({
            userID: x.userID,
            distance: Sql.spatial.distance(x.location, Sql.spatial.location(p.pune))
        }))
        .first();
    // console.log(near.distance);
    assert(near.distance > 100000);
}
