import { IClassOf } from "../../decorators/IClassOf.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
import { ShoppingContext, statusPublished } from "./ShoppingContext.js";

const status = statusPublished;

export async function createContext(driver: BaseDriver) {

    const copy = { ... driver } as BaseDriver;
    (copy as any).connectionString = { ... driver.connectionString };
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

export const headPhoneCategory = "head-phones";
function addHeadPhones(context: ShoppingContext, now: Date) {
    const category = context.categories.add({
        name: "Headphones",
        categoryID: headPhoneCategory
    });

    const startDate = new Date();
    const active = true;

    context.products.add({
        name: "Jabber Head Phones",
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

