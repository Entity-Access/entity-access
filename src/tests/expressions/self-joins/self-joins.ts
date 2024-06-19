import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";
import { ShoppingContext } from "../../model/ShoppingContext.js";
import { assertSqlMatch, trimInternal } from "../trimInternal.js";
import PostgreSqlDriver from "../../../drivers/postgres/PostgreSqlDriver.js";


export default function() {

    // const { driver } = this;

    // const context = new ShoppingContext(driver);
    // const c1 = "a";
    // const log = [];
    // let query = context.categories.where({ c1 }, (p) => (x) => x.categoryID === p.c1)
    //     .include((x) => x.children)
    //     .trace((x) => log.push(x))
    //     .first();

    // for (const iterator of log) {
    //     console.log(iterator);
    // }
}
