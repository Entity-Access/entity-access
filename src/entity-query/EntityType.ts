import type { IColumn, IEntityRelation } from "../decorators/IColumn.js";
import { IClassOf } from "../decorators/IClassOf.js";
import { Query } from "../query/Query.js";
import NameParser from "../decorators/parser/MemberParser.js";


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

        const existing = this.fieldMap.get(c.name);
        if (existing) {
            c.fkRelation = existing.fkRelation;
            c.fkRelation.fkColumn = c;
        }

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

    addRelation(relation: IEntityRelation) {
        // we will also set fk to the corresponding column
        this.relations.push(relation);

        // find fk...
        let fkColumn = this.fieldMap.get(relation.foreignKey);
        if(!fkColumn) {
            fkColumn = {
                name: relation.foreignKey,
                fkRelation: relation,
                dataType: "BigInt"
            };
            this.fieldMap.set(relation.foreignKey, fkColumn);
        }
        fkColumn.fkRelation = relation;
        relation.fkColumn = fkColumn;
        if (fkColumn.dataType === "Double") {
            fkColumn.dataType = "BigInt";
        }

    }

}