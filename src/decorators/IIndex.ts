export interface IIndexedColumn {
    name: string;
    descending: boolean;
}

export type IndexedColumn<T> = ((x: T) => any) | { name:((x: T) => any), descending: boolean};

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