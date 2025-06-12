export default interface IColumnSchema {
    name: string;
    dataType: string;
    length: number;
    nullable: boolean;
    default: string;
    key: boolean;
    computed?: any;
    ownerName?: string;
    ownerType?: string;
}

export interface IIndexSchema {
    name: string;
}

export interface IConstraintSchema {
    name: string;
}

export interface IForeignKeyConstraintSchema {
    name: string;
}