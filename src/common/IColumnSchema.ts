export default interface IColumnSchema {
    name: string;
    dataType: string;
    length: number;
    nullable: boolean;
    default: string;
    key: boolean;
}