import { IClassOf } from "../../decorators/IClassOf.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
import { ShoppingContext, User, statusPublished } from "./ShoppingContext.js";

const status = statusPublished;

export async function createContext(driver: BaseDriver) {

    const copy = { ... driver } as BaseDriver;
    (copy as any).connectionString = { ... driver.connectionString };
    Object.setPrototypeOf(copy, Object.getPrototypeOf(driver));
    const context = new ShoppingContext(copy);

    await context.driver.ensureDatabase();

    await context.driver.automaticMigrations().migrate(context);

    await seed(context);

    driver.connectionString.database = context.driver.connectionString.database;
    return context;

}

// export default function () {

// }

async function seed(context: ShoppingContext) {
    const now = new Date();

    // add admin user...
    context.users.add({
        userName: "admin",
        dateCreated: new Date()
    });
    // add seller
    const seller = context.users.add({
        userName: "self",
        dateCreated: new Date()
    });

    addHeadPhones(context, now, seller);

    const clothes = addMaleClothes(context, seller);

    addFemaleClothes(context, seller);

    await context.saveChanges();

    const product = clothes[0];
    const productPrice = product.prices[0];

    const user = context.users.add({
        userName: "customer1",
        dateCreated: new Date(),
        orders: [
            context.orders.add({
                orderDate: new Date(),
                orderItems:[
                    context.orderItems.add({
                        product,
                        productPrice,
                        amount: productPrice.amount
                    })
                ]
            })
        ]
    });

    await context.saveChanges();
}

function addFemaleClothes(context: ShoppingContext, owner: User) {
    const category = context.categories.add({
        name: "Female Clothes",
        categoryID: "clothes/female"
    });

    const startDate = new Date();
    const active = true;

    context.products.add({
        name: "White T-Shirt",
        owner,
        status,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                amount: 20,
                active,
                startDate
            })
        ]
    });

    context.products.add({
        name: "Red T-Shirt",
        status,
        owner,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                amount: 20,
                active,
                startDate
            })
        ]
    });

    context.products.add({
        name: "Blue T-Shirt",
        status,
        owner,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                amount: 20,
                active,
                startDate
            })
        ]
    });

    context.products.add({
        name: "Pink T-Shirt",
        status,
        owner,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                amount: 20,
                active,
                startDate
            })
        ]
    });
}

function addMaleClothes(context: ShoppingContext, owner: User) {
    const category = context.categories.add({
        name: "Male Clothes",
        categoryID: "clothes/male"
    });

    const startDate = new Date();
    const active = true;

    return [context.products.add({
        name: "White T-Shirt",
        status,
        owner,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                amount: 20,
                active,
                startDate
            })
        ]
    }),
    context.products.add({
        name: "Red T-Shirt",
        status,
        owner,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                amount: 20,
                active,
                startDate
            })
        ]
    }),
    context.products.add({
        name: "Blue T-Shirt",
        status,
        owner,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                amount: 20,
                active,
                startDate
            })
        ]
    }),
    context.products.add({
        name: "Pink T-Shirt",
        status,
        owner,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                amount: 20,
                active,
                startDate
            })
        ]
    })];
}

export const headPhoneCategory = "head-phones";
function addHeadPhones(context: ShoppingContext, now: Date, owner: User) {
    const category = context.categories.add({
        name: "Headphones",
        categoryID: headPhoneCategory
    });

    const startDate = new Date();
    const active = true;

    context.products.add({
        name: "Jabber Head Phones",
        owner,
        status,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                active,
                startDate,
                amount: 100
            })
        ]
    });

    context.products.add({
        name: "Sony Head Phones",
        owner,
        status,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                active,
                startDate,
                amount: 120
            })
        ]
    });

    context.products.add({
        name: "Sony Head Phones Black",
        status,
        owner,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                active,
                startDate,
                amount: 140
            })
        ]
    });

    context.products.add({
        name: "Sony Head Phones Blue",
        owner,
        status,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                active,
                startDate,
                amount: 140
            })
        ]
    });

    context.products.add({
        name: "Jabber Head Phones Black",
        status,
        owner,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                active,
                startDate,
                amount: 140
            })
        ]
    });

    context.products.add({
        name: "Jabber Head Phones Blue",
        owner,
        status,
        categories: [
            context.productCategories.add({
                category
            })
        ],
        prices: [
            context.productPrices.add({
                active,
                startDate,
                amount: 140
            })
        ]
    });
}

