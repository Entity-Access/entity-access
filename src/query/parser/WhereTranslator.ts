import * as a from "acorn";
import EntityQuery from "../../model/EntityQuery.js";
const { parse } = a;

export default class WhereTranslator {
    public static parse(text: string, query: EntityQuery) {
        const node = parse(text, { ecmaVersion: "latest"});
        const wt = new WhereTranslator(query);
        return wt.visit(node);
    }

    constructor(private query: EntityQuery) {

    }

    
}
