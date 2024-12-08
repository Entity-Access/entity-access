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

    /**
     * The reason for non recursive method is,
     * since circular json can have more depth then
     * visualized. And stack can grow to become
     * more complicated.
     * @param model model
     */
    *generate(model: any) {

        const stack = [] as IJsonToken[];
        const doneMap = new Map();

        stack.push({ target: model });
        while(stack.length) {

            const current = stack.pop();
            const { token } = current;

            if (token) {
                yield Buffer.from(token, "utf8");
                continue;
            }

            let { target: item } = current;

            if (item === void 0) {
                throw new Error("Invalid state");
            }
            if (item === null) {
                yield Buffer.from("null", "utf-8");
                continue;
            }

            switch(typeof item) {
                case "string":
                case "number":
                    yield Buffer.from(JSON.stringify(item), "utf-8");
                    continue;
                case "boolean":
                    yield Buffer.from(item ? "true" : "false", "utf-8");
                    continue;
                case "bigint":
                    yield Buffer.from(JSON.stringify(item.toString()), "utf-8");
                    continue;
                case "function":
                case "symbol":
                case "undefined":
                    continue;
            }

            let last;

            if (Array.isArray(item)) {
                last = item.length - 1;
                stack.push({ token: "]" });
                for (let index = last; index >= 0; index--) {
                    const element = item[index] ?? null;
                    if (index === last) {
                        stack.push({ target: element });
                        continue;
                    }
                    stack.push({ token: "," });
                    stack.push({ target: element });
                }
                yield Buffer.from("[", "utf-8");
                continue;
            }

            if (item instanceof Date) {
                yield Buffer.from( `"${item.toJSON()}"`, "utf-8");
                continue;
            }

            let $id = doneMap.get(item);
            if ($id) {
                yield Buffer.from(`{"$id": ${$id}}`, "utf-8");
                continue;
            }
            $id = doneMap.size + 1;
            doneMap.set(item, $id);

            this.serviceOwner?.attach(item);

            item = this.preJSON(item) ?? item;
            const tokens = [ { key: "$id", element: $id } ] as { key, element}[];
            for (const key in item) {
                if (Object.hasOwn(item, key)) {
                    const element = item[key];
                    if (element === void 0) {
                        continue;
                    }
                    tokens.push({ key, element });
                }
            }
            stack.push({ token: "}" });
            last = tokens.length - 1;
            for (let index = last; index >= 0; index--) {
                const { key, element } = tokens[index];
                if (index === last) {
                    stack.push({ target: element });
                    stack.push({ token: JSON.stringify(key) + ":"});
                    continue;
                }
                stack.push({ token: "," });
                stack.push({ target: element });
                stack.push({ token: JSON.stringify(key) + ":" });
            }
            yield Buffer.from("{", "utf-8");
        }

    }

    protected preJSON(item: any): any {
        return item.toJSON?.() ?? item;
    }

}