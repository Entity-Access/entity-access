# Entity Access

Inspired from Entity Framework Core, Entity Access is ORM for JavaScript runtime such as Node, YantraJS.


# Project Status
1. Released - Postgres Driver
2. Released - Sql Server Driver
3. Released - Include Feature

## Features
1. Unit of Work and Repository Pattern
2. Arrow function based query features with automatic joins.
3. Automatic Migrations for missing schema - this is done for fast development and deployment.
4. Sql functions such as LIKE, You can add your own custom functions easily.
5. Postgres Driver
6. Sql Server Driver
7. Automatic parameterization to safeguard sql injection attacks.
8. Context Filters - This is a new concept where you can setup filters that will be used against saving/retrieving data.

## Upcoming Features
1. Projection - Split query mode only, single level only.
2. Update column before save
3. GroupBy
4. Custom Migration Steps

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
    // first we will send parameters
    .where({ orderID },
        // second we will write an arrow
        // accepting parameters
        (p) =>
            // this is the arrow which will
            // be converted to SQL
            // you can write very limited set of
            // expressions in this arrow function
            (x) => x.orders.some(
                // This will results in exists or join
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
        WHERE x.customerID = o1.orderID
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
                p.userName
            )
);

// note that the join will be performed automatically
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

    @Column({ length: 200, computed: (x) => Sql.text.lower(x) })
    readonly lowerCaseUserName: string;
}

@Table("Products")
class Product {

    @Column({ key: true, generated: "identity"})
    productID: number;

    // Create a column with default expression
    @Column({ default: () => Sql.date.now()})
    dateUpdated: DateTime;

    // create a column with empty string as default
    @Column({ default: () => ""})
    productCode: string;

    orderItems: OrderItem[];
}

@Table("OrderItems")
class OrderItem {

    @Column({ key: true, generated: "identity"})
    orderItemID: number;

    @Column()
    /**
     * Following configuration declares Foreign Key Relation.
     * That will give compilation error if configured incorrectly.
     * 
     * RelateTo is for one to many mapping. Making column nullable will
     * inverse relation optional.
    */
    @RelateTo(Product, {
        property: (orderItem) => orderItem.product,
        inverseProperty: (product) => product.orderItems
    })
    productID: number;

    @Column()
    orderID: number;

    product: Product;

}

// You can use `RelateToOne` for one to one mapping.
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
    calculateAmount(total: number, units: number, taxId: string): Date {
        // in reality parseDate will return Date,
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

context.customers.all()
    .where({date}, (p) => (x) => x.birthDate < Sql.myFunctions.parseDate(p.date) );

```