import EntityContext from "../../model/EntityContext.js";
import Column from "../../decorators/Column.js";
import Relate, { RelateTo, RelateToOne } from "../../decorators/Relate.js";
import Table from "../../decorators/Table.js";
import Index from "../../decorators/Index.js";
import DateTime from "../../types/DateTime.js";

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
}

@Table("Users")
@Index({
    name: "IX_Unique_Users",
    columns: [(x) => x.userName],
    unique: true
})
export class User {

    @Column({ key: true , autoGenerate: true, dataType: "BigInt" })
    public userID: number;

    @Column({})
    public dateCreated: Date;

    @Column({ dataType: "Char", length: 200 })
    public userName: string;

    public profile: UserProfile;

    public ownedProducts: Product[];

    public orders: Order[];

    public categories: UserCategory[];

}

@Table("Categories")
export class Category {

    @Column({ key: true, dataType: "Char", length: 200 })
    public categoryID: string;

    @Column({ length: 200 })
    public name: string;

    public productCategories: ProductCategory[];

    public users: UserCategory[];

}

@Table("UserProfile")
export class UserProfile {

    @Column({ key: true, dataType: "BigInt"})
    @RelateToOne(User, {
        property: (up) => up.user,
        inverseProperty: (u) => u.profile
    })
    public userID: number;

    public fullName: string;

    public user: User;

    public photos: ProfilePhoto[];

}

@Table("ProfilePhotos")
export class ProfilePhoto {

    @Column({ key: true, dataType: "BigInt", autoGenerate: true })
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

    @Column({})
    public lastUpdated: DateTime;

    public user: User;

    public category: Category;
}

@Table("Products")
export class Product {

    @Column({ key: true, autoGenerate: true, dataType: "BigInt" })
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

    public orderItems: OrderItem[];
    public prices: ProductPrice[];
    public categories: ProductCategory[];
    public owner: User;

}


@Table("ProductCategories")
export class ProductCategory {

    @Column({ key: true, dataType: "BigInt", autoGenerate: true })
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
export class ProductPrice {

    @Column({ key: true, autoGenerate: true, dataType: "BigInt"})
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

    @Column({ key: true, autoGenerate: true, dataType: "BigInt"})
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

    public orderItems: OrderItem[];

    public customer: User;

}

@Table("OrderItems")
export class OrderItem {

    @Column({ key: true, autoGenerate: true, dataType: "BigInt"})
    public orderItemID: number;

    @Column()
    @RelateTo(Order, {
        property: (orderItem) => orderItem.order,
        inverseProperty: (order) => order.orderItems
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