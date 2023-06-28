import EntityContext from "../../EntityContext.js";
import ForeignKey from "../../entity-query/ForeignKey.js";

class ProductContext extends EntityContext {

}


class Product {


    public orders: Order[];

}

class Order {

    public orderItems: OrderItem[];

}

class OrderItem {

    @ForeignKey("orderID")
    public order: Order;

}

export default async function() {

}
