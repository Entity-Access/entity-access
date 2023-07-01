import { ISql } from "../sql/ISql.js";
import { SqlHelper } from "./sql/SqlHelper.js";

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

const names = flatten(SqlHelper, "Sql");

export default function SqlMethodTransformer(callee: string, args: string[]): string {
    return names[callee]?.(... args);
}
