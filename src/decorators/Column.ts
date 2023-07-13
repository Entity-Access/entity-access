import { addOrCreateColumnSymbol } from "../entity-query/EntityType.js";
import DateTime from "../types/DateTime.js";
import { IColumn } from "./IColumn.js";
import { ISqlType } from "./ISqlType.js";
import SchemaRegistry from "./SchemaRegistry.js";

import "reflect-metadata";

;
export default function Column(cfg: Omit<Omit<IColumn, "name">, "type"> = {}): any {
    return (target, key) => {
        const cn = target.constructor ?? target;
        const model = SchemaRegistry.model(cn);
        const c = model[addOrCreateColumnSymbol](key);
        for (const k in cfg) {
            if (Object.prototype.hasOwnProperty.call(cfg, k)) {
                const element = cfg[k];
                c[k] = element;
            }
        }
        c.columnName ??= key;
        c.name = key;
        c.nullable ??= false;
        c.order ??= model.columns.length;
        c.entityType = model;
        c.type = (Reflect as any).getMetadata("design:type", target, key);
        if (c.dataType === void 0) {
            c.dataType = typeFrom(c, c.type);
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
        case DateTime:
            return "DateTime";
        case Boolean:
            return "Boolean";
    }
    return "Char";
}
