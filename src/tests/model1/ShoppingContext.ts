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

}


@Table("Products")
export class Product {

    @Column({ key: true, autoGenerate: true, dataType: "bigint" })
    public productID: number;

    @Column()
    public name: string;

    @Column({ nullable: true })
    public ownerID: number;

    public orderItems: OrderItem[];

}

@Table("Orders")
export class Order {

    @Column({ key: true, autoGenerate: true, dataType: "bigint"})
    public orderID: number;

    @Column()
    public orderDate: Date;

    public orderItems: OrderItem[];

}

@Table("OrderItems")
export class OrderItem {

    @Column({ key: true, autoGenerate: true, dataType: "bigint"})
    public orderItemID: number;

    @Column()
    public orderID: number;

    @Column()
    public productID: number;

    @ForeignKey((x) => x.orderID, Order, (x) => x.orderItems)
    public order: Order;

    @ForeignKey((x) => x.productID, Product, (x) => x.orderItems)
    public product: Product;

}