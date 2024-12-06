import { Readable } from "stream";
import { ServiceProvider } from "../di/di.js";

type IJsonToken = {
    token: string;
    target?: never;
} | {
    token?: never;
    target: any;
};

export default class JsonReadable extends Readable {

    map = new Map();

    stack = [] as IJsonToken[];

    private readonly serviceOwner: ServiceProvider;

    constructor(
        private readonly model: any,
        serviceOwner?,
    ) {
        super();
        if (serviceOwner) {
            this.serviceOwner = ServiceProvider.from(serviceOwner);
        }
        this.stack.push({ target: model });
    }

    _read(size: number): void {
        console.log(size);
        if (this.stack.length) {
            this.nonRecursiveSerialize(size);
            return;
        }
        this.push(null);
    }

    nonRecursiveSerialize(size: number) {
        const { stack } = this;
        while(stack.length) {

            if (this.readableLength > size) {
                return;
            }

            const current = stack.pop();
            const { token } = current;

            if (token) {
                this.push(token, "utf-8");
                continue;
            }

            let { target: item } = current;

            if (item === void 0) {
                throw new Error("Invalid state");
            }
            if (item === null) {
                this.push("null", "utf-8");
                continue;
            }

            switch(typeof item) {
                case "string":
                case "number":
                    this.push(JSON.stringify(item), "utf-8");
                    continue;
                case "boolean":
                    this.push(item ? "true" : "false", "utf-8");
                    continue;
                case "bigint":
                    this.push(JSON.stringify(item.toString()), "utf-8");
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
                this.push("[", "utf-8");
                continue;
            }

            if (item instanceof Date) {
                this.push( `"${item.toJSON()}"`, "utf-8");
                continue;
            }

            let $id = this.map.get(item);
            if ($id) {
                this.push(`{"$id": ${$id}}`, "utf-8");
                continue;
            }
            $id = this.map.size + 1;
            this.map.set(item, $id);

            this.serviceOwner?.attach(item);

            item = item.toJSON?.() ?? item;
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
            this.push("{", "utf-8");
        }

    }

}