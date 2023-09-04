import { addOrCreateColumnSymbol } from "../entity-query/EntityType.js";
import DateTime from "../types/DateTime.js";
import { IColumn } from "./IColumn.js";
import { ISqlType } from "./ISqlType.js";
import SchemaRegistry from "./SchemaRegistry.js";

import "reflect-metadata";

interface IColumnDefinition<T> extends Omit<Omit<IColumn, "type">,"name"> {
    computed?: (x: T) => any;
    default?: () => any;
    stored?: boolean;
};

;
export default function Column<T>(cfg: IColumnDefinition<T> = {} as any): ((target: T, key: string) => any) {
    return (target:T, key) => {
        const cn = target.constructor ?? target;
        const model = SchemaRegistry.model(cn);
        const c = model[addOrCreateColumnSymbol](key);
        for (const k in cfg) {
            if (Object.prototype.hasOwnProperty.call(cfg, k)) {
                const element = cfg[k];
                c[k] = element;
            }
        }
        if (cfg.columnName) {
            cfg.explicitName = true;
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
        c.stored = cfg.stored;
        c.computed = cfg.computed;
        if (c.computed) {
            c.generated = "computed";
            c.stored ??= true;
        }
        c.default = cfg.default;

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
            return "DateTimeOffset";
        case Boolean:
            return "Boolean";
    }
    return "Char";
}
