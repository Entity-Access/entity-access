import ICheckConstraint from "./ICheckConstraint.js";
import { IClassOf } from "./IClassOf.js";
import SchemaRegistry from "./SchemaRegistry.js";

export default function CheckConstraint<T>(c: ICheckConstraint<T>) {
    return function(target: IClassOf<T>) {
        const model = SchemaRegistry.model(target);
        model.checkConstraints.push(c);
    };
}
