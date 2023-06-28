import EntityContext from "../../EntityContext.js";
import Column from "../../decorators/Column.js";
import ForeignKey from "../../decorators/ForeignKey.js";
import Identity from "../../decorators/Identity.js";
import NotMapped from "../../decorators/NotMapped.js";
import Table from "../../decorators/Table.js";

class ProductContext extends EntityContext {

}


@Table("Products")
class Product {

    @Column({ key: true, autoGenerate: true, dataType: "bigint" })
    public productID: number;

    @Column()
    public name: string;

    @Column({ nullable: true })
    public ownerID: number;

    public orderItems: OrderItem[];

}

@Table("Orders")
class Order {

    @Column({ key: true, autoGenerate: true, dataType: "bigint"})
    public orderID: number;

    @Column()
    public orderDate: Date;

    public orderItems: OrderItem[];

}

@Table("OrderItems")
class OrderItem {

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

export default async function() {

}
