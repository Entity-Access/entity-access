import type { IColumn, IEntityRelation } from "../decorators/IColumn.js";
import { IClassOf } from "../decorators/IClassOf.js";
import { Expression, NumberLiteral, ParameterExpression, SelectStatement, TableLiteral } from "../query/ast/Expressions.js";
import InstanceCache from "../common/cache/InstanceCache.js";
import { IIndex } from "../decorators/IIndex.js";
import { IStringTransformer } from "../query/ast/IStringTransformer.js";
import EntityAccessError from "../common/EntityAccessError.js";
import ICheckConstraint from "../decorators/ICheckConstraint.js";

export const addOrCreateColumnSymbol = Symbol("addOrCreateColumn");
export const addColumnSymbol = Symbol("addOrCreateColumn");

export interface IEntityProperty {
    field?: IColumn;
    relation?: IEntityRelation;
}


/**
 * DbQuery represents sql equivalent table with columns...
 */
export default class EntityType {

    public readonly typeClass: IClassOf<any>;

    public readonly name: string;
    public readonly schema: string;
    public readonly doNotCreate: string;
    public readonly entityName: string;


    public readonly columns: IColumn[] = [];

    public readonly relations: IEntityRelation[] = [];

    public readonly indexes: IIndex[] = [];

    public readonly checkConstraints: ICheckConstraint[] = [];

    public readonly keys: IColumn[] = [];

    public readonly nonKeys: IColumn[] = [];
    public readonly fullyQualifiedTableName: string;

    @InstanceCache
    public get fullyQualifiedName() {
        return this.schema
            ? TableLiteral.create({
                schema: Expression.identifier(this.schema) ,
                name: Expression.identifier(this.name)
            })
            : Expression.identifier(this.name);
    }

    private fieldMap: Map<string, IColumn> = new Map();
    private columnMap: Map<string, IColumn> = new Map();
    private relationMap: Map<string, IEntityRelation> = new Map();

    private selectAll: SelectStatement;
    private selectOne: SelectStatement;

    constructor(original?: EntityType, namingConvention?: IStringTransformer, quote?: IStringTransformer) {
        if (!original) {
            return;
        }
        this.typeClass = original.typeClass;
        this.name = namingConvention ? namingConvention(original.name) : original.name;
        this.schema = original.schema ? (namingConvention ? namingConvention(original.schema) : original.schema) : original.schema;
        this.entityName = original.entityName;
        this.doNotCreate = original.doNotCreate;
        this.fullyQualifiedTableName = quote
            ? (this.schema ? quote(this.schema) + "." + quote(this.name) : quote(this.name))
            : this.schema ? this.schema + "." + this.name : this.name;
    }

    [addOrCreateColumnSymbol](name: string): IColumn {
        return this.fieldMap.get(name) ?? { name };
    }

    public getProperty(name: string): IEntityProperty {
        const field = this.fieldMap.get(name);
        const relation = this.relationMap.get(name);
        return { field, relation };
    }

    public addColumn(c: IColumn) {

        const existing = this.fieldMap.get(c.name);
        if (existing) {
            const fkRelation = c.fkRelation = existing.fkRelation;
            if(fkRelation) {
                fkRelation.fkMap = [{ fkColumn: c, relatedKeyColumn: null }];
                // if(!fkRelation.fkMap?.length) {
                //     fkRelation.fkMap = [{ fkColumn: c, relatedKeyColumn: null}];
                // } else {
                //     if(fkRelation.fkMap.length === 1) {
                //         fkRelation.fkMap[0].fkColumn = c;
                //     }
                // }
            }
            // if (fkRelation?.fkMap) {
            //     if (!c.fkRelation.fkMap.length) {
            //         c.fkRelation.fkMap = [{ fkColumn: c, relatedKeyColumn: null }];
            //     } else {
            //         c.fkRelation.fkMap[0].fkColumn = c;
            //     }
            // } else {
            //     c
            // }
            // c.fkRelation.fkColumn = c;
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

    public getFieldMap(p: ParameterExpression) {
        return this.columns.map((x) => Expression.as( Expression.member( p, x.quotedColumnNameExp ), Expression.quotedIdentifier(x.name)));
    }


    addRelation(relation: IEntityRelation & { fkName?: string }, getInverseModel?: (t) => EntityType) {
        // we will also set fk to the corresponding column
        this.relations.push(relation);
        this.relationMap.set(relation.name, relation);

        if (!relation.fkMap) {
            // find fk...
            let fkColumn = this.fieldMap.get(relation.fkName);
            if(!fkColumn) {
                fkColumn = {
                    name: relation.fkName,
                    // columnName: relation.foreignKey,
                    fkRelation: relation,
                    dataType: "BigInt"
                };
                this.fieldMap.set(relation.fkName, fkColumn);
                relation.fkMap = [ { fkColumn, relatedKeyColumn: null} ];
            }
            fkColumn.fkRelation = relation;
            // relation.fkColumn = fkColumn;
            if (fkColumn.dataType === "Double") {
                fkColumn.dataType = "BigInt";
            }
        }

        if (!getInverseModel) {
            return relation;
        }

        // let us set inverse relations...
        const relatedType = getInverseModel(relation.relatedTypeClass);

        relation.fkMap[0].relatedKeyColumn ??= relatedType.keys[0];
        relation.fkMap = [ ... relation.fkMap.map((x) => ({ ... x}))];
        for (const iterator of relation.fkMap) {
            iterator.fkColumn = this.getField(iterator.fkColumn.name);
            // iterator.fkColumn.fkRelation = relation;
            if (!iterator.relatedKeyColumn) {
                throw new EntityAccessError(`Not key set for ${iterator.fkColumn.name} with keys in ${relatedType.name} `);
            }
            iterator.relatedKeyColumn = relatedType.getField(iterator.relatedKeyColumn.name);
            iterator.relatedKeyColumn.entityType = relatedType;
        }

        relation.relatedEntity = relatedType;
        const inverseRelation: IEntityRelation = {
            name: relation.relatedName,
            relatedName: relation.name,
            relatedTypeClass: this.typeClass,
            doNotCreateIndex: true,
            fkMap: null,
            isInverseRelation: true,
            isCollection: relation.singleInverseRelation ? false : true,
            relatedRelation: relation,
            relatedEntity: this
        };

        relatedType.relationMap.set(inverseRelation.name, inverseRelation);
        relatedType.relations.push(inverseRelation);
        inverseRelation.relatedRelation = relation;
        relation.relatedRelation = inverseRelation;

        let { foreignKeyConstraint } = relation;
        if(foreignKeyConstraint) {
            foreignKeyConstraint = {
                ... foreignKeyConstraint,
                fkMap: relation.fkMap,
                name: foreignKeyConstraint.name || `FK_${relation.type.name}_${relation.fkMap.map((r) => r.fkColumn.name).join("_")}`
            };
            foreignKeyConstraint.fkMap = relation.fkMap;
            relation.foreignKeyConstraint = foreignKeyConstraint;
            // if (relation.fkMap.length === 1) {
            //     const { fkColumn } = relation.fkMap[0];
            //     foreignKeyConstraint = { ... foreignKeyConstraint};
            //     relation.foreignKeyConstraint = foreignKeyConstraint;
            //     foreignKeyConstraint.name ||= `FK_${this.name}_${fkColumn.name}`;
            //     foreignKeyConstraint.column = fkColumn;
            //     foreignKeyConstraint.refColumns = relatedType.keys;
            // }
        }
        return relation;
    }

    public selectAllFields(as?: ParameterExpression) {
        // if (this.selectAll) {
        //     return { ... this.selectAll };
        // }
        const source = this.fullyQualifiedName;
        as ??= Expression.parameter(this.name[0] + "1", this);
        as.model = this;
        const fields = this.columns.map((c) => Expression.member(as, c.quotedColumnNameExp));
        this.selectAll = SelectStatement.create({
            source,
            model: this,
            sourceParameter: as,
            fields
        });
        return { ... this.selectAll };
    }

    public selectOneNumber() {
        // if (this.selectOne) {
        //     return { ... this.selectOne };
        // }
        const source = this.fullyQualifiedName;
        const as = Expression.parameter(this.name[0] + "1", this);
        as.model = this;
        const fields = [
            NumberLiteral.one
        ];
        this.selectOne = SelectStatement.create({
            source,
            model: this,
            sourceParameter: as,
            fields
        });
        return { ... this.selectOne };
    }

    // public map(row: any) {
    //     Object.setPrototypeOf(row, this.typeClass.prototype);
    //     return row;
    //     // const c = new this.typeClass();
    //     // for (const iterator of this.columns) {
    //     //     const value = row[iterator.columnName];
    //     //     if (value === void 0) {
    //     //         continue;
    //     //     }
    //     //     c[iterator.name] = value;
    //     // }
    //     // return c;
    // }
}