import SchemaRegistry from "./SchemaRegistry.js";

export interface ITable {
    name: string;
    schema?: string;
}

export default function Table<T>(
    name: string,
    schema?: string): any {
    return (target: T) => {
        const model = SchemaRegistry.model(target);
        // @ts-expect-error
        model.name = name;
        // @ts-expect-error
        model.schema = schema;
    }
}