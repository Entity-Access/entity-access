export interface IForeignKeyConstraint {
    schema?: string;
    table?: string;

    name?: string;

    validate?: boolean;
    index?: boolean;

    cascade?: "delete" | "restrict" | "null" | "default";

    columns?: {
        ownColumn?: string;
        refTable?: {
            schema?: string;
            name?: string;
            column?: string;
        };
    }[]
}
