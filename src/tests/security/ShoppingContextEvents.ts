import ContextEvents from "../../model/events/ContextEvents.js";
import { Order, OrderItem, Product, ProductCategory, ProductPrice, User } from "../model/ShoppingContext.js";
import { OrderEvents, OrderItemEvents } from "./events/OrderEvents.js";
import { ProductEvents, ProductCategoryEvents, ProductPriceEvents } from "./events/ProductEvents.js";
import { UserEvents } from "./events/UserEvents.js";

export class ShoppingContextEvents extends ContextEvents {

    constructor() {
        super();

        this.register(User, UserEvents);
        this.register(Product, ProductEvents);
        this.register(ProductCategory, ProductCategoryEvents);
        this.register(ProductPrice, ProductPriceEvents);
        this.register(Order, OrderEvents);
        this.register(OrderItem, OrderItemEvents);
    }

}