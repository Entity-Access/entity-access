import EntityType from "../entity-query/EntityType.js";
import { IClassOf } from "./IClassOf.js";
import { ISqlType } from "./ISqlType.js";


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

    precision?: number;
    scale?: number;

    /**
     * This will only be used to set collate while creating column.
     */
    collate?: string;

    entityType?: EntityType;

    /**
     * JavaScript Type
     */
    type?: any;

    /**
     * String representation of the default, empty string must be specified as ""
     */
    default?: string;

    /**
     * This only identifies itself as relation's foreign key, this will be set automatically.
     */
    fkRelation?: IEntityRelation;
}

export interface IEntityRelation {

    type?: EntityType;

    /**
     * Name of own field...
     */
    name: string;

    isInverseRelation?: boolean;

    isCollection?: boolean;


    foreignKey: string;

    relatedTypeClass: IClassOf<any>;

    fkColumn?: IColumn;


    relatedName: string;

    relatedKey?: string;


    relatedEntity?: EntityType;

    relatedRelation?: IEntityRelation;

    dotNotCreateIndex?: boolean;

}

