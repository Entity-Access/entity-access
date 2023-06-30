import EntityContext from "../../model/EntityContext.js";
import Column from "../../decorators/Column.js";
import ForeignKey from "../../decorators/ForeignKey.js";
import Table from "../../decorators/Table.js";
import PostgreSqlDriver from "../../drivers/postgres/PostgreSqlDriver.js";

export class ShoppingContext extends EntityContext {

    constructor(name?) {
        super(new PostgreSqlDriver({
            host: "127.0.0.1",
            database: name ?? "shopping",
            password: "abcd123",
            user: "postgres"
        }))
    }

    public products = this.model.register(Product);

    public orders = this.model.register(Order);

    public orderItems = this.model.register(OrderItem);

    public users = this.model.register(User);

}

@Table("Users")
export class User {

    @Column({ key: true , dataType: "Char" })
    public userID: string;

    public ownedProducts: Product[];

    public orders: Order[];

}


@Table("Products")
export class Product {

    @Column({ key: true, autoGenerate: true, dataType: "BigInt" })
    public productID: number;

    @Column()
    public name: string;

    @Column({ nullable: true })
    public ownerID: number;

    public orderItems: OrderItem[];

    @ForeignKey({
        key: (product) => product.ownerID,
        related: User,
        relatedProperty: (user) => user.ownedProducts
    })
    public owner: User;

}

@Table("Orders")
export class Order {

    @Column({ key: true, autoGenerate: true, dataType: "BigInt"})
    public orderID: number;

    @Column()
    public orderDate: Date;

    @Column()
    public customerID: string;

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

}