import Inject from "../../../di/di.js";
import { IEntityQuery } from "../../../model/IFilterWithParameter.js";
import EntityEvents from "../../../model/events/EntityEvents.js";
import { User } from "../../model/ShoppingContext.js";
import { UserInfo } from "./UserInfo.js";
export class UserEvents extends EntityEvents<User> {

    @Inject
    user: UserInfo;

    filter(query: IEntityQuery<User>): IEntityQuery<User> {
        if (this.user.admin) {
            return null;
        }
        const { userID } = this.user;
        return query.where({ userID }, (p) => (x) => x.userID === p.userID
            || x.orders.some(
                (op) => op.orderItems.some((oi) => oi.product.ownerID === p.userID)));
    }

    modify(query: IEntityQuery<User>): IEntityQuery<User> {
        if (this.user.admin) {
            return null;
        }
        const { userID } = this.user;
        return query.where({ userID}, (p) => (x) => x.userID === p.userID);
    }
}