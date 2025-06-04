[![Action Status](https://github.com/Entity-Access/entity-access/workflows/Build/badge.svg)](https://github.com/Entity-Access/entity-access/actions) [![npm version](https://badge.fury.io/js/%40entity-access%2Fentity-access.svg)](https://badge.fury.io/js/%40entity-access%2Fentity-access) 
# Entity Access

Inspired from Entity Framework Core, Entity Access is ORM for JavaScript runtime such as Node, YantraJS.


# Project Status
1. Released - Postgres Driver
2. Released - Sql Server Driver
3. Released - Include Feature
4. Planned - MySql Driver
5. Planned - Oracle Driver (Need help, we do not have Oracle Expertise)

## Features
1. Arrow function based query features with automatic joins.
2. Unit of Work and Repository Pattern
3. Automatic Migrations for missing schema - this is done for fast development and deployment.
4. Sql functions such as LIKE, You can add your own custom functions easily.
5. Postgres Driver
6. Sql Server Driver
7. Automatic parameterization to safeguard sql injection attacks.
8. Context Filters - This is a new concept where you can setup filters that will be used against saving/retrieving data.
9. Sum and Count query methods.
10. Composite Primary Key Support.

## Upcoming Features
1. Projection - Split query mode only, single level only.
2. Update column before save
3. GroupBy
4. Custom Migration Steps
5. MySql support

### Unit of Work

```typescript
const db = new ShoppingContext();
db.orders.add({
    orderDate: new Date(),
    userID,
    orderItems: [
        db.orderItems.add({
            productID,
            amount
        })
    ]
});

// save all in single transaction
await db.saveChanges();

const existingOrderItem1: OrderItem;
const existingOrderItem2: OrderItem;

existingOrderItem2.status = "cancelled";
existingOrderItem1.status = "cancelled";
// executes update statements in single transaction
await db.saveChanges();


db.orderItems.delete(existingOrderItem1);
db.orderItems.delete(existingOrderItem2);
// executes delete statements in single transaction
await db.saveChanges();

```

### Arrow function based query features

Arrow function based query provides many benefits over tagged template literals or other fluent methods to build queries.
1. Arrow functions are easy to visualize.
2. You will get intellisense help to complete the query.
3. You will get errors if the wrong data types are compared or used in computations.
4. Change of property name will automatically refactor as typescript will keep references of where the property is used.

Simple Query
```typescript
const db = new ShoppingContext();

// find customer from orderID
const q = db.customers
    // set parameters
    .where({ orderID },
        // access parameters
        (p) =>
            // following expression
            // be converted to SQL
            (customer) => customer.orders.some(
                // joins/exists will be set
                // based on relations declared
                (order) => order.orderID === p.orderID );
const customer = await q.first();
```
Above expression will result in following filter expression
```sql
    SELECT c.firstName, c.lastName, c.customerID
    FROM customers as c
    EXISTS (
        SELECT 1
        FROM Orders as o1
        WHERE c.customerID = o1.orderID
            AND o1.orderID = $1
    )
    LIMIT 1;
```

Query with Like operator
```typescript
/// Find all orders for specified customer
/// Sql functions
const userName = `akash%`;
const q = db.orders.where({ userName },
    (params) =>
        (order) =>
            Sql.text.like(
                order.customer.userName,
                params.userName
            )
);

// note that the join will be performed automatically
```

Following query will be generated for the query.
```sql
    SELECT o.orderID, o.orderDate, o.customerID, ...
    FROM orders as o
        INNER JOIN customers c
            ON c.customerID = o.customerID
    WHERE
        c.userName like $1
```

### Typed Configurations
```typescript
class ShoppingContext {
    products = this.model.register(Product);
    orders = this.model.register(Order);
    orderItems = this.model.register(OrderItem);
    users = this.model.register(User);
}

@Table("Users")
@Index({
    name: "IX_Unique_Usernames",
    unique: true,
    columns: [{ name: (x) => x.lowerCaseUserName, descending: false }]
})
class User {
    @Column({ key: true, generated: "identity"})
    userID: number;

    @Column({ length: 200 })
    userName: string;

    /**
     * Create computed column
    */
    @Column({ length: 200, computed: (x) => Sql.text.lower(x.userName) })
    readonly lowerCaseUserName: string;
}

@Table("Products")
@CheckConstraint({
    name: "CX_Products_PositivePrice",
    filter: (x) => x.price > 0
})
class Product {

    @Column({ key: true, generated: "identity"})
    productID: number;

    // Create a column with default expression
    // the expression will be converted to equivalent SQL
    // for the target provider `NOW()` for postgresql and
    // `GETUTCDATE()` for sql server.
    @Column({ default: () => Sql.date.now()})
    dateUpdated: DateTime;

    // create a column with empty string as default
    @Column({ default: () => ""})
    productCode: string;

    // You can specifiy computed expression
    // that will be converted to equivalent SQL
    // for target provider.
    @Column({
        /* Certain providers might need length such as postgresql*/
        length: 200,
        computed: (p) => Sql.text.concatImmutable(Sql.cast.asText(p.productID), p.productCode)
    })
    readonly slug: string;

    @Column({ dataType: "Decimal" })
    price: number;

    orderItems: OrderItem[];
}

@Table("OrderItems")
class OrderItem {

    @Column({ key: true, generated: "identity"})
    orderItemID: number;

    @Column({})
    /**
     * Following configuration declares Foreign Key Relation.
     * That will give compilation error if configured incorrectly.
     * 
     * RelateTo is for one to many mapping. Making column nullable will
     * inverse relation optional.
    */
    @RelateTo(Product, {
        property: (orderItem) => orderItem.product,
        inverseProperty: (product) => product.orderItems,
        foreignKeyContraint: {
                name: "FK_OrderItems_ProductID",
                onDelete: "restrict"
        }
    })
    productID: number;

    @Column({})
    @RelateTo(Order, {
        property: (orderItem) => orderItem.order,
        inverseProperty: (order) => order.orderItems,
        foreignKeyContraint: {
                name: "FK_OrderItems_OrderID",
                onDelete: "delete"
        }
    })
    orderID: number;

    product: Product;

    order: Order;

}

// You can use `RelateToOne` for one to one mapping.

// To prevent circular dependency issues, you can also use different
// arguments as shown below...

    @RelateTo({
        type: () => Product
        property: (orderItem) => orderItem.product,
        inverseProperty: (product) => product.orderItems
    })
    productID: number;
```

## Query Examples

### Compare operators

Only handful of operators are supported as of now.
1. Equality Both `==`, `===`, will result in simple `=` operator in SQL. There is no type check performed and no conversion is performed to speed up
execution. However, typescript will give you warning and compilation for mismatch of operands and you can convert them as needed. But for conversion
use only `Sql.*` functions.
2. Above also applies for operators `!=` and `!==`, they will result in `<>` in SQL.
3. `+`, `-`, `*`, `/` operators will be sent to SQL as it is.
4. For precedence, we recommend using brackets in the arrow functions as there might be differences in underlying database engine's preferences and you may not get correct results.
5. Template Literals, will be sent to SQL as concat, however, please use
conversion of non string to string type if underlying provider does not support direct conversion.
6. Conversion methods, `Sql.cast.as*` methods will provide conversion from any type to desired type. `Sql.cast.asText` will convert to number to text.

#### Equality
Both strict and non strict equality will result in
simple equality comparison in SQL. Database provider
may or may not convert them correctly, so we recommend
using helper functions to convert before comparison.
```typescript
    const q = db.customers
        .where({ orderID },
            (p) =>
                (x) => x.orders.some(
                    (order) => order.orderID === p.orderID )
        )

```
> SQL Server does not recognize boolean field as a true/false, so to make your query compatible, you must use `(x) => x.isActive === true` to make it work correctly in sql server.

#### IN

To use `IN` operator, you can simply use javascript's `in` keyword.
```typescript
let all = await db.products.where(void 0, (p) => (x) =>
        x.productType in ["mobile", "laptop"]
    ).toArray();
```

Above query will result in following expression.

```sql
SELECT ... FROM products as p1 WHERE p1.productType in ('mobile', 'laptop')
```

However, you can also send `in` parameters as parameters as shown below.

```typescript
const productTypes = ["mobile", "laptop"];
all = await db.products.where({ productTypes }, (p) => (x) =>
        x.productType in p.productTypes
    ).toArray();
```

Above query will result in following expression.

```sql
SELECT ... FROM products as p1 WHERE p1.productType in ($1, $2)
```


#### Like

To use `LIKE` operator, `Sql.text.like` method must be used
as it is. Query compiler will only match everything starting
with `Sql.` and it will inject available operator conversion.

You don't have to worry about sql injection as each parameter
passed will be sent as a sql parameter and not as a literal.

```typescript
    const prefix = `${name}%`;
    db.customers.where({ prefix },
        (p) =>
            (customer) => Sql.text.like(customer.firstName, p.prefix)
                || Sql.text.like(customer.lastName p.prefix)
    )
```

#### Sql Text Functions
For other sql text functions you can use `Sql.text.startsWith`, `Sql.text.endsWith`, `Sql.text.left`... etc as shown below.
```typescript
    db.customers.where({ prefix },
        (p) =>
            (customer) => Sql.text.startsWith(customer.firstName, p.prefix)
                || Sql.text.startsWith(customer.lastName p.prefix)
    )
```

#### Sql date functions
Just as text functions you can also use date functions as shown below.
```typescript
    const year = (new Date()).getFullYear();
    // get count of all orders of this year...
    db.orders.where({ year },
        (p) =>
            (order) => Sql.date.yearOf(order.orderDate) === p.year
    )

    // above example is only for illustrations only, it will not use index.
    // for index usage, please consider window function shown below.
    const start:Date = /* start date */;
    const end:Date = /* start date */;
    // get count of all orders of this year...
    db.orders.where({ start, end },
        (p) =>
            (order) => p.start <= order.orderDate && order.orderDate >= p.end
    )

```

### OrderBy
```typescript
    q.orderBy({}, (p) => (x) => x.orderDate)
    .thenBy({}, (p) => (x) => x.customer.firstName)

    // custom...
    q.orderBy({}, (p) => (x) => x.orderDate)
    .thenBy({}, (p) => (x) => Sql.text.collate(x.customer.firstName, "case_insensitive"))

```

### Limit/Offset
```typescript
    q = q.orderByDescending({}, (p) => (x) => x.orderDate)
    .thenBy({}, (p) => (x) => x.customer.firstName)
    .limit(50)
    .offset(50);
```

### Enumerate
```typescript
    for await(const product of q.enumerate()) {
        //
    }
```

### First / First or Fail
```typescript
    // it will return first product or null
    const firstProduct = await q.first();

    // it will throw and exception if product was not
    // found
    const firstProduct = await q.firstOrFail();
```

### Count
```typescript
    const total = await q.count();
```

## Bulk Updates
### Update
Following query will mark all users as active if they
logged in within 30 days.
```typescript
    const past30 = DateTime.now.addDays(-30);
    db.users.asQuery()
        .update({ past30 }, (p) => (x) => ({
            active: Sql.cast.asBoolean(
                x.lastLogin > p.past30
            )
        }))
```
### Delete
Following query will delete all users who did not login
within one year.
```typescript
    const past365 = DateTime.now.addYears(-1);
    db.users.asQuery()
        .delete({ past365 }, (p) =>
            (x) => x.lastLogin < p.past365)
```
### Insert
Following query will insert all old messages to
archivedMessages table and delete from messages
in a single transaction.

Everything happens on database server, no entity
is loadded in the memory.

```typescript
    const past365 = DateTime.now.addYears(-1);

    using tx = await db.connection.createTransaction();

    const oldMessagesQuery = db.messages
        .where({ past365 }, (p) =>
            (x) => x.dateCreated < p.past365 );

    oldMessagesQuery.insertInto(db.archivedMessages);

    oldMessagesQuery.delete(void 0, (p) => (x) => x.messageID !== null);

    await tx.commit();

```

## Direct Statements
Entity Context provides direct statements to save/retrieve entities without loading them into change context.

### Select
```typescript
   const msg = await context.messages.statements.select({
       messageID
   });
```

### Insert
```typescript
    const msg = await context.messages.statements.insert({
       from,
       to,
       subject,
       body
    });
```

### Update
```typescript
   await context.messages.statements
        .update(
            /** Changes */
            { archived: true },
            /** key */
            { messageID }
        )
```

### Upsert
```typescript
   await context.messages.statements
        .upsert(
            /** Changes */
            { read: 1 },
            /** Apply update for an existing entity */
            (existing) => ({
                ... existing,
                read: existing.read + 1
            })
            /** key */
            { messageID }
        )
```

## Provide Custom Sql Methods...
We have provided most used methods, however, to add inbuilt methods, we request you to submit feature request or pull request.

Let's say you have custom function defined in your database and you want to invoke them.

We will extend ISql interface.

```typescript
import Sql from "@entity-access/entity-access/dist/sql/Sql.js";
import ISql from "@entity-access/entity-access/dist/sql/ISql.js";
import { prepareAny } from "@entity-access/entity-access/dist/query/ast/IStringTransformer.js";

declare module "@entity-access/entity-access/dist/sql/ISql.js" {
    interface ISql {
        myFunctions: {
            calculateAmount(total: number, units: number, taxId: string): Date;
        }
    }
}

Sql.myFunctions = {
    calculateAmount(total: number, units: number, taxId: string): number {
        // in reality this function will return number,
        // but expression to sql compiler expects an array of
        // strings and functions. Function represents parameters
        // being sent to SQL. Parameters cannot be accessed here.
        // So a placeholder function to parameter will be sent to
        // this method and it should be passed as it is in array
        // as shown below.

        // note how comma is inserted as separate string literal.
        return ["mySchema.calculateAmount(", total, "," , units , "," , taxId, ")"] as any;

        // DO NOT EVER USE THE FOLLOWING
        return `mySchema.calculateAmount(${total}, ${units},${taxId})`;

        // INSTEAD you can use prepareAny function 
        // In case if you need to use something else, you can return an array and send
        // parameters as it is.

        // Also you will not be able to convert the inputs to string because
        // each input will only return the function declaration instead of the value as a text.
        return prepareAny `mySchema.calculateAmount(${total}, ${units},${taxId})`;
    }
};

// now you can use this as shown below...

context.orders.all()
    .where({amount}, (p) => (x) =>
        Sql.mySchema.calculateAmount(x.total, x.units, x.taxId) < p.amount );

```

## Context Filters and Events

Let's assume that you wan to setup filters in such a way that customer can only 
access his own orders.

In order to setup context filters and events, we need to use inbuilt dependency injection, to provide, access to current user and events.

```typescript
export class ProductEvents extends EntityEvents<Product> {

    @Inject
    user: User;

    @Inject
    notificationService: NotificationService;

    filter(query: IEntityQuery<Product>) {
        const { userID } = this.user ?? {};
        if (userID) {

            // user can only see products that
            // user has purchased or products are
            // active.

            return query.where({ userID }, (p) =>
                p.isActive
                || x.orderItems.some((oi) =>
                    oi.order.customerID === p.userID
                )
            );
        }

        // anonymous users can see only active products        
        return query.where({ userID }, (p) => p.isActive === true);
    }

    /*
    When you are using eager loading, you can avoid adding
    extra filters for each relation if the parent is already
    filtered. For example, if you are trying to list products
    inside orders, since order is already filtered, you can 
    return query as it is.
    */
    includeFilter(query: IEntityQuery<Product>, type, member) {
        if(type === OrderItem) {
            return query;
        }
        // for every other include
        // use normal filter.
        return this.filter(query);
    }

    /*
    this will be called just before
    save changes, before the actual editing occurs,
    we will automatically determine if the product
    can be edited or not by the current use.
    */

    /*
    This will also work correctly when there are multiple
    entities in the single transaction.
    */
    
    modifyFilter(query: IEntityQuery<Product>) {
        const { userID } = this.user ?? {};
        if (userID) {

            // user can only see products that
            // user has purchased or products are
            // active.

            return query.where({ userID }, (p) =>
                p.isActive === true
                || x.orderItems.some((oi) =>
                    oi.order.customerID === p.userID
                )
            );
        }
        throw new EntityAccessError(`Cannot edit the product`);
    }

    // after above filter has passed the entity
    // following methods will be raised for every entity
    beforeInsert(entity: Product, entry: ChangeEntry<Product>) {

    }

    // each of these methods, beforeInsert, afteInsert, beforeUpdate
    // afterUpdate, beforeDelete and afterDelete are asynchronous and
    // you can await on async methods.
    async afterInsert(entity: Product, entry: ChangeEntry<Product>) {
        await this.notificationService.notify(entity);
    }

}


// register all events in context events..
export class AppContextEvents extends ContextEvents{

    constructor() {
        this.register(Product, ProductEvents);
    }
}
const allEvents = new AppContextEvents();

// create context with context events.

const db = new ShoppingContext(allEvents);


// this will return the query with filter
const products = db.filteredQuery<Product>(Product);
```
