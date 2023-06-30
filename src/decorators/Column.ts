import { IColumn } from "./IColumn.js";
import { ISqlType } from "./ISqlType.js";
import SchemaRegistry from "./SchemaRegistry.js";

import "reflect-metadata";

;
export default function Column(cfg: Omit<Omit<IColumn, "name">, "type"> = {}): any {
    return (target, key) => {
        const cn = target.constructor ?? target;
        const model = SchemaRegistry.model(cn);
        const c = cfg as IColumn;
        c.columnName ??= key;
        c.name = key;
        c.nullable ??= false;
        c.order ??= model.columns.length;
        c.type = model;

        if (c.dataType === void 0) {
            const jsType = (Reflect as any).getMetadata("design:type", target, key);
            c.dataType = typeFrom(c, jsType);
        }


        model.addColumn(c);
    };
}

function typeFrom(c: IColumn, jsType: any): ISqlType {
    switch(jsType) {
        case String:
            return "Char";
        case Number:
            if (c.key) {
                return "BigInt";
            }
            return "Double";
        case BigInt:
            return "BigInt";
        case Date:
            return "DateTime";
        case Boolean:
            return "Boolean";
    }
    return "Char";
}
