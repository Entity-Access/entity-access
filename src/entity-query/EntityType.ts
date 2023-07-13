import type { IColumn, IEntityRelation } from "../decorators/IColumn.js";
import { IClassOf } from "../decorators/IClassOf.js";
import { Query } from "../query/Query.js";
import NameParser from "../decorators/parser/NameParser.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import { Expression, ExpressionAs, QuotedLiteral, SelectStatement, TableLiteral } from "../query/ast/Expressions.js";
import InstanceCache from "../common/cache/InstanceCache.js";


/**
 * DbQuery represents sql equivalent table with columns...
 */
export default class EntityType {

    public readonly typeClass: IClassOf<any>;

    public readonly name: string;
    public readonly schema: string;
    public readonly entityName: string;


    public readonly columns: IColumn[] = [];

    public readonly relations: IEntityRelation[] = [];

    public readonly keys: IColumn[] = [];

    public readonly nonKeys: IColumn[] = [];

    @InstanceCache
    public get fullyQualifiedName() {
        return this.schema
            ? TableLiteral.create({
                schema: QuotedLiteral.create({literal: this.schema}) ,
                name: QuotedLiteral.create({ literal: this.name })
            })
            : QuotedLiteral.create({ literal: this.name });
    }

    private fieldMap: Map<string, IColumn> = new Map();
    private columnMap: Map<string, IColumn> = new Map();
    private relationMap: Map<string, IEntityRelation> = new Map();

    private selectAll: SelectStatement;
    private selectOne: SelectStatement;

    public getProperty(name: string) {
        const field = this.fieldMap.get(name);
        const relation = this.relationMap.get(name);
        return { field, relation };
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
        this.relationMap.set(relation.name, relation);

        // find fk...
        let fkColumn = this.fieldMap.get(relation.foreignKey);
        if(!fkColumn) {
            fkColumn = {
                name: relation.foreignKey,
                columnName: relation.foreignKey,
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

        // let us set inverse relations...
        const relatedType = SchemaRegistry.model(relation.relatedTypeClass);
        relation.relatedEntity = relatedType;
        const inverseRelation: IEntityRelation = {
            name: relation.relatedName,
            foreignKey: "",
            relatedName: relation.name,
            relatedTypeClass: this.typeClass,
            dotNotCreateIndex: true,
            fkColumn,
            isInverseRelation: true,
            isCollection: true,
            relatedRelation: relation,
            relatedEntity: this
        };

        relatedType.relationMap.set(inverseRelation.name, inverseRelation);
        relatedType.relations.push(inverseRelation);
        inverseRelation.relatedRelation = relation;
        relation.relatedRelation = inverseRelation;
        return relation;
    }

    public selectAllFields() {
        if (this.selectAll) {
            return { ... this.selectAll };
        }
        const source = this.fullyQualifiedName;
        const as = Expression.parameter(this.name[0] + "1");
        const fields = this.columns.map((c) => c.name !== c.columnName
            ? ExpressionAs.create({
                expression: Expression.member(as, c.columnName),
                alias: QuotedLiteral.create({ literal: c.name })
            })
            : Expression.member(as, c.columnName));
        this.selectAll = SelectStatement.create({
            source,
            model: this,
            sourceParameter: as,
            fields
        });
        return { ... this.selectAll };
    }

    public selectOneNumber() {
        if (this.selectOne) {
            return { ... this.selectOne };
        }
        const source = this.fullyQualifiedName;
        const as = Expression.parameter(this.name[0] + "1");
        const fields = [
            Expression.identifier("1")
        ];
        this.selectOne = SelectStatement.create({
            source,
            model: this,
            sourceParameter: as,
            fields
        });
        return { ... this.selectOne };
    }
}