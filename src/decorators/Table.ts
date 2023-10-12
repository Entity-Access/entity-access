import SchemaRegistry from "./SchemaRegistry.js";

export interface ITable {
    name: string;
    schema?: string;
    entityName?: string;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export default function Table<T extends Function>(
    name: string,
    schema?: string): any {
    return (target: T) => {
        const model = SchemaRegistry.model(target);
        // @ts-expect-error readonly
        model.name = name;
        // @ts-expect-error readonly
        model.schema = schema;
    };
}

export function EntityName(name: string) {
    return (target) => {
        SchemaRegistry.registerClassForName(name, target);
    };
}

export function DoNotCreate() {
    return (target) => {
        const model = SchemaRegistry.model(target);
        // @ts-expect-error readonly
        model.doNotCreate = true;
    };
}