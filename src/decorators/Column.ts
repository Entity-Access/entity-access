import EntityType from "../entity-query/EntityType.js";
import SchemaRegistry from "./SchemaRegistry.js";

export type ISqlType = 
    /**
     * BigInt, long, 8 bytes
     */
    "BigInt"
    /**
     * Integer, 4 bytes
     */
    | "Int"
    /**
     * Floating Point number, 4 bytes only
     */
    | "Float"
    /**
     * Double, floating point number, 8 bytes
     */
    | "Double"
    /**
     * Date and Time, usually 8 bytes
     */
    | "DateTime"
    /**
     * Ascii character, single byte, do not use for unicode
     */
    | "AsciiChar"
    /**
     * Unicode character
     */
    | "Char"
    
    /**
     * Single bit
     */
    | "Boolean";

export interface IColumn {
    name?: string;
    columnName?: string;
    order?: number;
    key?: boolean;
    autoGenerate?: boolean;
    dataType?: ISqlType;
    nullable?: boolean;
    /**
     * If length is specified, it will take exact same length always.
     */
    fixed?: boolean;
    /**
     * If length is not specified, text will be unlimited or variable length with maximum size.
     */
    length?: number;
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