import EntityContext from "../../model/EntityContext.js";
import Column from "../../decorators/Column.js";
import ForeignKey from "../../decorators/ForeignKey.js";
import Table from "../../decorators/Table.js";

export const statusPublished = "published";

export class ShoppingContext extends EntityContext {

    public categories = this.model.register(Category);

    public productCategories = this.model.register(ProductCategory);

    public products = this.model.register(Product);

    public productPrices = this.model.register(ProductPrice);

    public orders = this.model.register(Order);

    public orderItems = this.model.register(OrderItem);

    public users = this.model.register(User);

}

@Table("Users")
export class User {

    @Column({ key: true , autoGenerate: true, dataType: "BigInt" })
    public userID: number;

    @Column({})
    public dateCreated: Date;

    public ownedProducts: Product[];

    public orders: Order[];

}

@Table("Categories")
export class Category {

    @Column({ key: true, dataType: "Char", length: 200 })
    public categoryID: string;

    @Column({ length: 200 })
    public name: string;

    public productCategories: ProductCategory[];

}


@Table("Products")
export class Product {

    @Column({ key: true, autoGenerate: true, dataType: "BigInt" })
    public productID: number;

    @Column()
    public name: string;

    @Column({ nullable: true })
    public ownerID: number;

    @Column({ dataType: "Char", length: 20})
    public status: string;

    public orderItems: OrderItem[];

    public prices: ProductPrice[];

    public categories: ProductCategory[];

    @ForeignKey({
        key: (product) => product.ownerID,
        related: User,
        relatedProperty: (user) => user.ownedProducts
    })
    public owner: User;

}


@Table("ProductCategories")
export class ProductCategory {

    @Column({ key: true, dataType: "BigInt", autoGenerate: true })
    public productCategoryID: number;

    @Column({ dataType: "BigInt" })
    public productID: number;

    @Column({ dataType: "Char", length: 200})
    public categoryID: string;

    @ForeignKey({
        key: (pc) => pc.productID,
        related: Product,
        relatedProperty: (c) => c.categories
    })
    public product: Product;

    @ForeignKey({
        key: (pc) => pc.categoryID,
        related: Category,
        relatedProperty: (c) => c.productCategories
    })
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

    public amount: number;

    public productID: number;

    @ForeignKey({
        key: (productPrice) => productPrice.productID,
        related: Product,
        relatedProperty: (product) => product.prices
    })
    public product: Product;

    public orderItems: OrderItem[];
}

@Table("Orders")
export class Order {

    @Column({ key: true, autoGenerate: true, dataType: "BigInt"})
    public orderID: number;

    @Column()
    public orderDate: Date;

    @Column()
    public customerID: number;

    public orderItems: OrderItem[];

    @ForeignKey({
        key: (order) => order.customerID,
        related: User,
        relatedProperty: (user) => user.orders
    })
    public customer: User;

}

@Table("OrderItems")
export class OrderItem {

    @Column({ key: true, autoGenerate: true, dataType: "BigInt"})
    public orderItemID: number;

    @Column()
    public orderID: number;

    @Column()
    public productID: number;

    @Column()
    public priceID: number;

    @Column()
    public amount: number;

    @ForeignKey({
        key: (orderItem) => orderItem.orderID,
        related: Order,
        relatedProperty: (order) => order.orderItems
    })
    public order: Order;

    @ForeignKey({
        key: (orderItem) => orderItem.productID,
        related: Product,
        relatedProperty:(product) => product.orderItems
    })
    public product: Product;


    @ForeignKey({
        key: (orderItem) => orderItem.priceID,
        related: ProductPrice,
        relatedProperty: (productPrice) => productPrice.orderItems
    })
    public productPrice: ProductPrice;

}