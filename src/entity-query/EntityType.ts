import type { IColumn } from "../decorators/Column.js";
import { IClassOf } from "../decorators/IClassOf.js";
import { Query } from "../query/Query.js";


interface IEntityRelation {

    type?: EntityType;
    
    /**
     * Name of own field...
     */
    name: string;

    isCollection?: boolean;

    
    foreignKey: string;

    relatedTypeClass: IClassOf<any>;

    relatedName: string;


    relatedEntity?: EntityType;

    relatedRelation?: IEntityRelation;

}

/**
 * DbQuery represents sql equivalent table with columns...
 */
export default class EntityType {

    public readonly typeClass: IClassOf<any>;

    public readonly name: string;
    public readonly schema: string;

    private fieldMap: Map<string, IColumn> = new Map();
    private columnMap: Map<string, IColumn> = new Map();

    public readonly columns: IColumn[] = [];

    public readonly relations: IEntityRelation[] = [];

    public readonly keys: IColumn[] = [];

    public readonly nonKeys: IColumn[] = [];

    public get fullyQualifiedName() {
        return this.schema ? Query.quotedLiteral(this.schema, this.name) : Query.quotedLiteral(this.name);
    }

    public addColumn(c: IColumn) {
        this.fieldMap.set(c.name, c);
        this.columnMap.set(c.columnName, c);
        this.columns.push(c);
        if (c.key) {
            this.keys.push(c);
        } else {
            this.nonKeys.push(c);
        }
    }

    public getColumn(name: string) {
        return this.columnMap.get(name);
    }

    public getField(name: string) {
        return this.fieldMap.get(name);
    }
}