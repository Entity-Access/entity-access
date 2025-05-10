import type EntityType from "../entity-query/EntityType.js";
import { FKType, IColumn } from "./IColumn.js";


export interface IForeignKeyConstraint {

    name?: string;

    type?: EntityType;

    validate?: boolean;
    index?: boolean;

    onDelete?: "cascade" | "restrict" | "set-null" | "set-default";

    fkMap?: FKType[];
}
