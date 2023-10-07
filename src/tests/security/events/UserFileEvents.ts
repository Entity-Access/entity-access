import { IEntityQuery } from "../../../index.js";
import EntityEvents from "../../../model/events/EntityEvents.js";
import { UserFile } from "../../model/UseFile.js";

export class UserFileEvents extends EntityEvents<UserFile> {

    filter(query: IEntityQuery<UserFile>): IEntityQuery<UserFile> {
        return query.where({}, (p) => (x) => x.photoUsers.some((p1) => p1.orders.some((o1) => true)));
    }

}