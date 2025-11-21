export type operatorClasses = "varchar_pattern" | "text_pattern" | "bpchar_pattern" | "default" ;

export interface IIndexedColumn {
    name: string;
    descending: boolean;
    operatorClass?: operatorClasses;
}

export type IndexedColumn<T> = ((x: T) => any) | { name:((x: T) => any), descending: boolean, operatorClass?: operatorClasses};

export default interface IIndexDef<T = any> {
    name: string;
    columns: IndexedColumn<T>[];
    unique?: boolean;
    include?: ((x:T) => any)[];
    indexType?: string;
    filter?: (x: T) => boolean;
}

export interface IIndex{
    name: string;
    columns: IIndexedColumn[];
    unique?: boolean;
    include?: string[];
    indexType?: string;
    filter?: ((x: any) => boolean) | string;
}