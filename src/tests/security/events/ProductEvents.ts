import EntityAccessError from "../../../common/EntityAccessError.js";
import Inject from "../../../di/di.js";
import { IEntityQuery } from "../../../model/IFilterWithParameter.js";
import ChangeEntry from "../../../model/changes/ChangeEntry.js";
import EntityEvents from "../../../model/events/EntityEvents.js";
import { Product, ProductCategory, ProductPrice } from "../../model/ShoppingContext.js";
import { UserInfo } from "./UserInfo.js";
const statusPublished = "published";

export class ProductEvents extends EntityEvents<Product> {

    @Inject
    user: UserInfo;

    filter(query: IEntityQuery<Product>): IEntityQuery<Product> {
        const { userID } = this.user;

        // admin can access everything so return null
        if (this.user.admin) {
            return null;
        }
        // everyone can read published or own products
        return query.where({ userID, statusPublished }, (p) => (x) => x.ownerID === p.userID || x.status === p.statusPublished);
    }

    modify(query: IEntityQuery<Product>): IEntityQuery<Product> {
        const { userID } = this.user;

        // admin can access everything so return null
        if (this.user.admin) {
            return null;
        }

        // customer can modify its own products
        return query.where({ userID }, (p) => (x) => x.ownerID === p.userID);
    }

    afterUpdate(entity: Product, entry: ChangeEntry<Product>): void | Promise<void> {
        entity.updated = Array.from(entry.updated.keys()).map((x) => x.name);
        entity.nameUpdated = entry.isUpdated("name");
    }

}

export class ProductCategoryEvents extends EntityEvents<ProductCategory> {

    @Inject
    user: UserInfo;

    filter(query: IEntityQuery<ProductCategory>): IEntityQuery<ProductCategory> {
        return null;
    }

    modify(query: IEntityQuery<ProductCategory>): IEntityQuery<ProductCategory> {
        const { userID } = this.user;

        // admin can access everything so return null
        if (this.user.admin) {
            return null;
        }

        EntityAccessError.throw("Access denied");
    }

}


export class ProductPriceEvents extends EntityEvents<ProductPrice> {

    @Inject
    user: UserInfo;

    filter(query: IEntityQuery<ProductPrice>): IEntityQuery<ProductPrice> {

        const { userID } = this.user;

        // admin can access everything so return null
        if (this.user.admin) {
            return null;
        }

        // user can view prices of only published or own products
        return query.where({ userID, statusPublished } , (p) => (x) => x.product.status === p.statusPublished || x.product.ownerID === p.userID);
    }

    modify(query: IEntityQuery<ProductPrice>): IEntityQuery<ProductPrice> {
        const { userID } = this.user;

        // admin can access everything so return null
        if (this.user.admin) {
            return null;
        }

        // user can only edit its own prices
        return query.where({ userID }, (p) => (x) => x.product.ownerID === p.userID);
    }

}