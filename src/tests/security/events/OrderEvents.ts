import Inject, { ServiceProvider } from "../../../di/di.js";
import { IEntityQuery } from "../../../model/IFilterWithParameter.js";
import ChangeEntry from "../../../model/changes/ChangeEntry.js";
import EntityEvents, { ForeignKeyFilter } from "../../../model/events/EntityEvents.js";
import DateTime from "../../../types/DateTime.js";
import { Order, OrderItem, ShoppingContext } from "../../model/ShoppingContext.js";
import { UserInfo } from "./UserInfo.js";

export class OrderEvents extends EntityEvents<Order> {

    @Inject
    user: UserInfo;

    filter(query: IEntityQuery<Order>): IEntityQuery<Order> {
        if (this.user.admin) {
            return null;
        }
        const { userID } = this.user;

        // user can access orders placed by the user or orders with products owned by user

        return query.where({ userID }, (x, p) => x.customerID === p.userID || x.orderItems.some((item) => item.product.ownerID === p.userID));
    }

    modify(query: IEntityQuery<Order>): IEntityQuery<Order> {
        if (this.user.admin) {
            return null;
        }
        const { userID } = this.user;
        // user can only modify placed orders
        return query.where({ userID }, (x, p) => x.customerID === p.userID || x.orderItems.some((item) => item.product.ownerID === p.userID));
    }

    onForeignKeyFilter(filter: ForeignKeyFilter<Order>): IEntityQuery<any> {
        if (filter.is((x) => x.customer)) {
            return filter.read();
        }
    }

}

export class OrderItemEvents extends EntityEvents<OrderItem> {

    @Inject
    user: UserInfo;

    filter(query: IEntityQuery<OrderItem>): IEntityQuery<OrderItem> {
        if (this.user.admin) {
            return null;
        }
        const { userID } = this.user;

        // user can access orders placed by the user or orders with products owned by user

        return query.where({ userID }, (x, p) => x.order.customerID === p.userID || x.product.ownerID === p.userID);
    }

    modify(query: IEntityQuery<OrderItem>): IEntityQuery<OrderItem> {
        if (this.user.admin) {
            return null;
        }
        const { userID } = this.user;
        // user can only modify placed orders
        return query.where({ userID }, (x, p) => x.order.customerID === p.userID || x.product.ownerID === p.userID);
    }

    onForeignKeyFilter(filter: ForeignKeyFilter<OrderItem>): IEntityQuery<any> {
        if (filter.is((x) => x.product)) {
            return filter.read();
        }
        if (filter.is((x) => x.productPrice)) {
            return filter.read();
        }
    }

    beforeInsert(entity: OrderItem, entry: ChangeEntry): void | Promise<void> {
        if (!entity.priceID && !entity.productID) {
            const db = ServiceProvider.resolve(this, ShoppingContext);
            const start = DateTime.now;

            const product = db.products.add({
                status: "a",
                name: "b",
            });
            entity.productPrice = db.productPrices.add({
                amount: 10,
                product,
                active: true,
                startDate: start.asJSDate,
                endDate: start.addYears(1).asJSDate
            });
            entity.product = product;
        }
    }
}