import { Readable } from "stream";
import { ServiceProvider } from "../di/di.js";

export default class JsonGenerator {


    private readonly serviceOwner: ServiceProvider;

    private map: Map<any, any>;

    constructor(
        serviceOwner?
    ) {
        if (serviceOwner) {
            this.serviceOwner = ServiceProvider.from(serviceOwner);
        }
    }

    reader(model: any) {
        return Readable.from(this.generate(model), { encoding: "utf-8"});
    }

    *generate(model) {

        this.map = new Map();

        /**
         * This method will unwrap recursive generate
         * into non recursive execution.
         */

        const iterator = this.recursiveGenerate(model);

        const stack = [];

        let current = iterator;

        let text = void 0;

        for(;;) {
            const { value, done } = current.next();

            if (typeof value === "string") {
                text = text === void 0 ? value : text + value;
                if (text.length > 1024) {
                    yield text;
                    text = void 0;
                }
                // yield value;
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

        if (text !== void 0) {
            yield text;
        }

    }

    protected preJSON(item: any): any {
        return item.toJSON?.() ?? item;
    }

    private *recursiveGenerate(model): Generator<any, any, any> {
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
                yield this.recursiveGenerate(element);
            }
            yield "]";
            return;
        }
        const { map } = this;
        let $id = map.get(model);
        if ($id) {
            yield `{"$ref": ${$id}}`;
            return;
        }
        $id = map.size + 1;
        map.set(model, $id);

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
                yield this.recursiveGenerate(element);
            }
        }

        yield `}`;

    }

}