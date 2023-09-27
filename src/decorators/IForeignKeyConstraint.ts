import type EntityType from "../entity-query/EntityType.js";
import { IColumn } from "./IColumn.js";


export interface IForeignKeyConstraint {

    name?: string;

    type?: EntityType;

    validate?: boolean;
    index?: boolean;

    cascade?: "delete" | "restrict" | "set-null" | "set-default";

    column?: IColumn;

    refColumns?: IColumn[];
}
