import EntityContext from "../../model/EntityContext.js";
import Column from "../../decorators/Column.js";
import { RelateTo, RelateToOne } from "../../decorators/Relate.js";
import Table from "../../decorators/Table.js";
import Index from "../../decorators/Index.js";
import DateTime from "../../types/DateTime.js";
import { UserFile } from "./UseFile.js";
import Sql from "../../sql/Sql.js";
import MultiForeignKeys from "../../decorators/ForeignKey.js";
import CheckConstraint from "../../decorators/CheckConstraint.js";

export const statusPublished = "published";

export class ShoppingContext extends EntityContext {

    public categories = this.model.register(Category);

    public productCategories = this.model.register(ProductCategory);

    public products = this.model.register(Product);

    public productPrices = this.model.register(ProductPrice);

    public orders = this.model.register(Order);

    public orderItems = this.model.register(OrderItem);

    public users = this.model.register(User);

    public userCategories = this.model.register(UserCategory);

    public userProfiles = this.model.register(UserProfile);

    public profilePhotos = this.model.register(ProfilePhoto);

    public userFiles = this.model.register(UserFile);

    public emailAddresses = this.model.register(EmailAddress);

    public userCategoryTags = this.model.register(UserCategoryTag);

    public messages = this.model.register(UserMessage);

    public archivedMessages = this.model.register(ArchivedUserMessage);

    public cachedItems = this.model.register(CachedItem);
}

@Table("CachedItems")
export class CachedItem {

    @Column({ key: true, dataType: "Char", length: 200 })
    key: string;

    @Column({ dataType: "Char"})
    data: string;
}

@Table("Users")
@Index({
    name: "IX_Unique_Users",
    columns: [(x) => x.userName],
    unique: true
})
export class User {

    @Column({ key: true , generated: "identity", dataType: "BigInt" })
    public userID: number;

    @Column({})
    public dateCreated: Date;

    @Column({ dataType: "Char", length: 200 })
    public userName: string;

    @Column({ dataType: "BigInt", nullable: true })
    @RelateTo({
        type: () => UserFile,
        property: (u) => u.photo,
        inverseProperty: (uf) => uf.photoUsers
    })
    public photoID: number;

    public profile: UserProfile;

    public ownedProducts: Product[];

    public orders: Order[];

    public categories: UserCategory[];

    public files: UserFile[];

    public photo: UserFile;
}

@Table("EmailAddresses")
@Index({
    name: "IX_Unique_EmailAddress",
    columns: [{ name: (x) => x.address , descending: false }],
    unique: true
})
export class EmailAddress {

    @Column({ key: true, generated: "identity"})
    public id: number;

    @Column({ dataType: "Char", length: 200 })
    public address: string;

    @Column({ dataType: "Char", length: 200, nullable: true })
    public name: string;

}

@Table("Categories")
export class Category {

    @Column({ key: true, dataType: "Char", length: 200 })
    public categoryID: string;

    @Column({ length: 200 })
    public name: string;


    @Column({ computed: (x) => Sql.text.lower(x.name)})
    public lowerName: string;

    @Column({ dataType: "Char", length: 200, nullable: true })
    @RelateTo(Category, {
        property: (c) => c.parent,
        inverseProperty: (c) => c.children
    })
    public parentID: string;

    @Column({
        dataType: "Char",
        length: 400,
        nullable: true,
        computed: (x) => x.parentID === null ? null : Sql.text.concatImmutable(Sql.cast.asText(x.parentID), '/', Sql.text.lower(x.name))
    })
    public path: string;

    public productCategories: ProductCategory[];

    public users: UserCategory[];

    public children: Category[];

    public parent: Category;

}

@Table("UserProfile")
export class UserProfile {

    @Column({ key: true, dataType: "BigInt"})
    @RelateToOne(User, {
        property: (up) => up.user,
        inverseProperty: (u) => u.profile,
        foreignKeyConstraint: {
            name: "FC_UserProfiles_User",
            onDelete: "cascade"
        }
    })
    public profileID: number;

    public fullName: string;

    public user: User;

    public photos: ProfilePhoto[];

}

@Table("ProfilePhotos")
export class ProfilePhoto {

    @Column({ key: true, dataType: "BigInt", generated: "identity" })
    public photoID: number;

    @Column ({ dataType: "BigInt"})
    @RelateTo(UserProfile, {
        property: (pp) => pp.profile,
        inverseProperty: (up) => up.photos
    })
    public profileID: number;

    @Column({ dataType: "Char"})
    public url: string;

    public profile: UserProfile;
}

@Table("UserCategories")
export class UserCategory {

    @Column({ key: true, dataType: "BigInt" })
    @RelateTo(User, {
        property: (uc) => uc.user,
        inverseProperty: (u) => u.categories
    })
    public userID: number;

    @Column({ key: true, dataType: "Char", length: 200 })
    @RelateTo(Category, {
        property: (uc) => uc.category,
        inverseProperty: (c) => c.users
    })
    public categoryID: string;

    @Column({ default: () => Sql.date.now()})
    public lastUpdated: DateTime;

    public user: User;

    public category: Category;

    public tags: UserCategoryTag[];
}

@Table("UserCategoryTags")
export class UserCategoryTag {

    @Column({ key: true, dataType: "BigInt", generated: "identity"})
    tagID: number;

    @Column({ dataType: "Char", length: 200 })
    tag: string;

    @Column({ dataType: "BigInt"})
    public userID: number;

    @Column({ dataType: "Char", length: 200 })
    public categoryID: string;

    @MultiForeignKeys(UserCategory, {
            inverseProperty: (x) => x.tags,
            foreignKeys: [
                { foreignKey: (x) => x.userID, key: (x) => x.userID },
                { foreignKey: (x) => x.categoryID, key: (x) => x.categoryID}
            ]
        }
    )
    public userCategory: UserCategory;

}

@Table("Products")
export class Product {

    @Column({ key: true, generated: "identity", dataType: "BigInt" })
    public productID: number;

    @Column()
    public name: string;

    @Column({ nullable: true })
    @RelateTo(User, {
        property: (product) => product.owner,
        inverseProperty: (user) => user.ownedProducts
    })
    public ownerID: number;

    @Column({ dataType: "Char", length: 20})
    public status: string;

    @Column({ dataType: "Char", nullable: true})
    public productDescription: string;

    public orderItems: OrderItem[];
    public prices: ProductPrice[];
    public categories: ProductCategory[];
    public owner: User;

    public updated: string[];
    public nameUpdated: boolean;
    afterInsertInvoked: boolean;

}


@Table("ProductCategories")
export class ProductCategory {

    @Column({ key: true, dataType: "BigInt", generated: "identity" })
    public productCategoryID: number;

    @Column({ dataType: "BigInt" })
    @RelateTo(Product, {
        property: (pc) => pc.product,
        inverseProperty: (p) => p.categories
    })
    public productID: number;

    @Column({ dataType: "Char", length: 200})
    @RelateTo(Category, {
        property: (pc) => pc.category,
        inverseProperty: (c) => c.productCategories
    })
    public categoryID: string;

    public product: Product;

    public category: Category;
}

@Table("ProductPrices")
@CheckConstraint({
    name: "CX_ProductPrices_PositivePrice",
    filter: (x) => x.amount > 0
})
export class ProductPrice {

    @Column({ key: true, generated: "identity", dataType: "BigInt"})
    public priceID: number;

    @Column()
    public active: boolean;

    @Column()
    public startDate: Date;

    @Column({ nullable: true})
    public endDate?: Date;

    @Column({ })
    public amount: number;

    @Column({})
    @RelateTo(Product, {
        property: (price) => price.product,
        inverseProperty: (p) => p.prices
    })
    public productID: number;

    public product: Product;
    public orderItems: OrderItem[];
}

@Table("Orders")
@Index({
    name: "IX_Orders_PO",
    columns: [{ name: (x) => x.purchaseOrder , descending: false }],
    filter: (x) => x.purchaseOrder !== null
})
export class Order {

    @Column({ key: true, generated: "identity", dataType: "BigInt"})
    public orderID: number;

    @Column()
    public orderDate: Date;

    @Column()
    @RelateTo(User, {
        property: (order) => order.customer,
        inverseProperty: (user) => user.orders
    })
    public customerID: number;

    @Column({ dataType: "Char", length: 200, nullable: true})
    public purchaseOrder: string;

    @Column({ dataType: "Char", length: 20, default: () => "pending"})
    public status: string;

    @Column({ dataType: "Decimal", default: () => 0})
    public total: number;

    public orderItems: OrderItem[];

    public customer: User;

}

@Table("OrderItems")
export class OrderItem {

    @Column({ key: true, generated: "identity", dataType: "BigInt"})
    public orderItemID: number;

    @Column()
    @RelateTo({
        type: () => Order,
        property: (orderItem) => orderItem.order,
        inverseProperty: (order) => order.orderItems,
        foreignKeyConstraint: {
            onDelete: "cascade"
        }
    })
    public orderID: number;

    @Column()
    @RelateTo(Product, {
        property: (orderItem) => orderItem.product,
        inverseProperty: (product) => product.orderItems
    })
    public productID: number;

    @Column()
    @RelateTo(ProductPrice, {
        property: (orderItem) => orderItem.productPrice,
        inverseProperty: (productPrice) => productPrice.orderItems
    })
    public priceID: number;

    @Column()
    public amount: number;

    public order: Order;
    public product: Product;
    public productPrice: ProductPrice;

}

@Table("UserMessages")
export class UserMessage {

    @Column({ dataType: "BigInt", key: true, generated: "identity"})
    messageID: number;

    @Column({ dataType: "BigInt"})
    fromID: number;

    @Column({ dataType: "BigInt"})
    toID: number;

    @Column({ dataType: "Char"})
    message: string;
}

@Table("ArchivedUserMessages")
export class ArchivedUserMessage {

    @Column({ dataType: "BigInt", key: true, generated: "identity"})
    messageID: number;

    @Column({ dataType: "BigInt"})
    fromID: number;

    @Column({ dataType: "BigInt"})
    toID: number;

    @Column({ dataType: "Char"})
    message: string;
}