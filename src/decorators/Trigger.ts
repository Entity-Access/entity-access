import { IClassOf } from "./IClassOf.js";
import ITrigger from "./ITrigger.js";
import SchemaRegistry from "./SchemaRegistry.js";

export default function Trigger<T1, T>(t: ITrigger<T1, T>) {
    return function(target: IClassOf<T>) {
        const model = SchemaRegistry.model(target);
        model.checkConstraints.push(t);
    };
}