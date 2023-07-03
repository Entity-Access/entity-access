import { IClassOf } from "../../decorators/IClassOf.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
import { ShoppingContext } from "./ShoppingContext.js";

export async function createContext(driver: BaseDriver) {

    const rn = "d" + Date.now();
    const copy = { ... driver } as BaseDriver;
    (copy as any).connectionString = { ... driver.connectionString };
    copy.connectionString.database = rn;
    Object.setPrototypeOf(copy, Object.getPrototypeOf(driver));
    const context = new ShoppingContext(copy);

    await context.driver.ensureDatabase();

    await context.driver.automaticMigrations().migrate(context);

    await seed(context);

    return context;

}

// export default function () {

// }

async function seed(context: ShoppingContext) {
    const now = new Date();

    addHeadPhones(context, now);

    const maleClothes = addMaleClothes(context);

    const femaleClothes = addFemaleClothes(context);

    await context.saveChanges();
}

function addFemaleClothes(context: ShoppingContext) {
    const category = context.categories.add({
        name: "Female Clothes",
        categoryID: "clothes/female"
    });

    const startDate = new Date();
    const active = true;

    context.products.add({
        name: "White T-Shirt",
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

function addMaleClothes(context: ShoppingContext) {
    const category = context.categories.add({
        name: "Male Clothes",
        categoryID: "clothes/male"
    });

    const startDate = new Date();
    const active = true;

    context.products.add({
        name: "White T-Shirt",
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

function addHeadPhones(context: ShoppingContext, now: Date) {
    const category = context.categories.add({
        name: "Headphones",
        categoryID: "head-phones"
    });

    const startDate = new Date();
    const active = true;

    context.products.add({
        name: "Jabber Head Phones",
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

