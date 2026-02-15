import { Readable } from "stream";
import { ServiceProvider } from "../di/di.js";

type IJsonToken = {
    token: string;
    target?: never;
} | {
    token?: never;
    target: any;
};

export default class JsonGenerator {


    private readonly serviceOwner: ServiceProvider;

    constructor(
        serviceOwner?
    ) {
        if (serviceOwner) {
            this.serviceOwner = ServiceProvider.from(serviceOwner);
        }
    }

    reader(model: any) {
        return Readable.from(this.generate(model));
    }

    *generate(model) {

        /**
         * This method will unwrap recursive generate
         * into non recursive execution.
         */

        const map = new Map();
        const iterator = this.recursiveGenerate(model, map);

        const stack = [];

        let current = iterator;

        for(;;) {
            const { value, done } = current.next();

            if (typeof value === "string") {
                yield value;
                continue;
            }

            if (done) {
                if (stack.length) {
                    current = stack.pop();
                    continue;
                }
                break;
            }

            stack.push(current);
            current = value;
        }

    }

    private *recursiveGenerate(model, doneMap: Map<any,any>): Generator<any, any, any> {
        switch(typeof model) {
            case "bigint":
            case "string":
                yield JSON.stringify(model.toString());
                return;
            case "number":
                yield model.toString();
                return;
            case "boolean":
                yield model ? "true" : "false";
                return;
            case "undefined":
                return;
        }

        if (model === null) {
            yield "null";
            return;
        }

        if (model instanceof Date) {
            yield `"${model.toJSON()}"`;
            return;
        }

        let suffix = "";

        if (Array.isArray(model)) {
            yield "[";
            for (const element of model) {
                if (suffix) {
                    yield suffix;
                } else {
                    suffix = ",";
                }
                yield this.recursiveGenerate(element, doneMap);
            }
            yield "]";
            return;
        }

        let $id = doneMap.get(model);
        if ($id) {
            yield `{"$ref": ${$id}}`;
            return;
        }
        $id = doneMap.size + 1;
        doneMap.set(model, $id);

        this.serviceOwner?.attach(model);

        model = this.preJSON(model) ?? model;

        const nest = "";

        yield `{${nest}"$id": ${$id}`;
        for (const key in model) {
            if (Object.hasOwn(model, key)) {
                const element = model[key];
                if (element === void 0) {
                    continue;
                }
                yield ",";
                if (nest) {
                    yield nest;
                }
                yield JSON.stringify(key);
                yield `:`;
                if (element === null) {
                    yield "null";
                    continue;
                }
                switch(typeof element) {
                    case "bigint":
                        yield JSON.stringify(element.toString());
                        continue;
                    case "boolean":
                        yield element ? "true": "false";
                        continue;
                    case "string":
                    case "number":
                        yield JSON.stringify(element);
                        continue;
                }
                if (element instanceof Date) {
                    yield `"${element.toJSON()}"`;
                    continue;
                }
                yield this.recursiveGenerate(element, doneMap);
            }
        }

        yield `}`;

    }

    // /**
    //  * The reason for non recursive method is,
    //  * since circular json can have more depth then
    //  * visualized. And stack can grow to become
    //  * more complicated.
    //  * @param model model
    //  */
    // *singleStackGenerate(model: any) {

    //     const stack = [] as IJsonToken[];
    //     const doneMap = new Map();

    //     stack.push({ target: model });
    //     while(stack.length) {

    //         const current = stack.pop();
    //         const { token } = current;

    //         if (token) {
    //             yield Buffer.from(token, "utf8");
    //             continue;
    //         }

    //         let { target: item } = current;

    //         if (item === void 0) {
    //             throw new Error("Invalid state");
    //         }
    //         if (item === null) {
    //             yield Buffer.from("null", "utf-8");
    //             continue;
    //         }

    //         switch(typeof item) {
    //             case "string":
    //             case "number":
    //                 yield Buffer.from(JSON.stringify(item), "utf-8");
    //                 continue;
    //             case "boolean":
    //                 yield Buffer.from(item ? "true" : "false", "utf-8");
    //                 continue;
    //             case "bigint":
    //                 yield Buffer.from(JSON.stringify(item.toString()), "utf-8");
    //                 continue;
    //             case "function":
    //             case "symbol":
    //             case "undefined":
    //                 continue;
    //         }

    //         let last;

    //         if (Array.isArray(item)) {
    //             last = item.length - 1;
    //             stack.push({ token: "]" });
    //             for (let index = last; index >= 0; index--) {
    //                 const element = item[index] ?? null;
    //                 if (index === last) {
    //                     stack.push({ target: element });
    //                     continue;
    //                 }
    //                 stack.push({ token: "," });
    //                 stack.push({ target: element });
    //             }
    //             yield Buffer.from("[", "utf-8");
    //             continue;
    //         }

    //         if (item instanceof Date) {
    //             yield Buffer.from( `"${item.toJSON()}"`, "utf-8");
    //             continue;
    //         }

    //         let $id = doneMap.get(item);
    //         if ($id) {
    //             yield Buffer.from(`{"$id": ${$id}}`, "utf-8");
    //             continue;
    //         }
    //         $id = doneMap.size + 1;
    //         doneMap.set(item, $id);

    //         this.serviceOwner?.attach(item);

    //         item = this.preJSON(item) ?? item;
    //         const tokens = [ { key: "$id", element: $id } ] as { key, element}[];
    //         for (const key in item) {
    //             if (Object.hasOwn(item, key)) {
    //                 const element = item[key];
    //                 if (element === void 0) {
    //                     continue;
    //                 }
    //                 tokens.push({ key, element });
    //             }
    //         }
    //         stack.push({ token: "}" });
    //         last = tokens.length - 1;
    //         for (let index = last; index >= 0; index--) {
    //             const { key, element } = tokens[index];
    //             if (index === last) {
    //                 stack.push({ target: element });
    //                 stack.push({ token: JSON.stringify(key) + ":"});
    //                 continue;
    //             }
    //             stack.push({ token: "," });
    //             stack.push({ target: element });
    //             stack.push({ token: JSON.stringify(key) + ":" });
    //         }
    //         yield Buffer.from("{", "utf-8");
    //     }

    // }

    protected preJSON(item: any): any {
        return item.toJSON?.() ?? item;
    }

}