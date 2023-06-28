import EntityType from "../entity-query/EntityType.js";
import SchemaRegistry from "./SchemaRegistry.js";

export interface IColumn {
    name?: string;
    columnName?: string;
    order?: number;
    key?: boolean;
    autoGenerate?: boolean;
    dataType?: string;
    nullable?: boolean;

    type?: EntityType;
};
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
        model.addColumn(c);
    };
}