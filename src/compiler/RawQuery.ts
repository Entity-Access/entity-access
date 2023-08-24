import { BaseConnection, BaseDriver } from "../drivers/base/BaseDriver.js";
import { ITextQuery } from "../query/ast/IStringTransformer.js";

export default class RawQuery {

    constructor(public readonly query: ITextQuery) {
    }

    public invoke<T>(connection: BaseConnection, p: any, signal?: AbortSignal) {
        const q = this.process(p);
        return connection.executeQuery(q, signal);
    }

    private process(p: any = {}) {
        let text = "";
        const values = [];
        const query = this.query;
        for (const iterator of query) {
            if (typeof iterator !== "function") {
                text += iterator;
                continue;
            }
            const value = iterator(p);
            if (Array.isArray(value)) {
                for (const av of value) {
                    if (typeof av !== "function") {
                        text += av;
                        continue;
                    }
                    values.push(av());
                    text += "$" + values.length;
                }
                continue;
            }
            values.push(value);
            text += "$" + values.length;
        }
        return { text, values };
    }
}
