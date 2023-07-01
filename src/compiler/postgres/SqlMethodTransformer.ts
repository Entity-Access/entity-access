import { ISql } from "../../sql/ISql.js";
import { PostgreSqlHelper } from "./SqlHelper.js";

const flatten = (f, name, target = {}) => {
    for (const key in f) {
        if (Object.prototype.hasOwnProperty.call(f, key)) {
            const element = f[key];
            if (typeof element === "function") {
                target[name + "." + key] = element;
                continue;
            }
            if (typeof element !== "object") {
                continue;
            }
            flatten(element, name + "." + key, target);
        }
    }
    return target;
};

const names = flatten(PostgreSqlHelper, "Sql");

export default function PostgreSqlMethodTransformer(callee: string, args: string[]): string {
    return names[callee]?.(... args);
}
