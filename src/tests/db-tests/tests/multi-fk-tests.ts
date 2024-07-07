import assert from "assert";
import { TestConfig } from "../../TestConfig.js";
import { createContext } from "../../model/createContext.js";

export default async function(this: TestConfig) {

    if (!this.db) {
        return;
    }

    const context = await createContext(this.driver);

    const { userID } = await context.users.asQuery().first();
    const { categoryID } = await context.categories.asQuery().first();

    await context.userCategories.statements.insert({
        userID,
        categoryID
    });

    await context.userCategoryTags.statements.insert({
        categoryID,
        userID,
        tag: "A"
    });
    await context.userCategoryTags.statements.insert({
        categoryID,
        userID,
        tag: "B"
    });

    const first = await context.userCategories.asQuery()
        .include((x) => x.tags)
        .first();

    assert.notEqual(void 0, first.tags);
}