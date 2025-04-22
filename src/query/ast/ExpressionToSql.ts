import EntityAccessError from "../../common/EntityAccessError.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import EntityType, { IEntityProperty } from "../../entity-query/EntityType.js";
import EntityQuery from "../../model/EntityQuery.js";
import { FilteredExpression, filteredSymbol } from "../../model/events/FilteredExpression.js";
import { NotSupportedError } from "../parser/NotSupportedError.js";
import { ArrowFunctionExpression, BigIntLiteral, BinaryExpression, BooleanLiteral, CallExpression, CoalesceExpression, ConditionalExpression, Constant, DeleteStatement, ExistsExpression, Expression, ExpressionAs, ExpressionType, Identifier, InsertStatement, JoinExpression, MemberExpression, UpsertStatement, NewObjectExpression, NotExits, NullExpression, NumberLiteral, OrderByExpression, ParameterExpression, ReturnUpdated, SelectStatement, StringLiteral, TableLiteral, TemplateLiteral, UnionStatement, UpdateStatement, ValuesStatement, NotExpression, ArrayExpression, BracketExpression, NegateExpression } from "./Expressions.js";
import { ITextQuery, QueryParameter, joinMap, prepare, prepareJoin } from "./IStringTransformer.js";
import ParameterScope from "./ParameterScope.js";
import Visitor from "./Visitor.js";

interface IPropertyChain {
    identifier?: Identifier,
    parameter?: ParameterExpression,
    chain: { member: string, args?: Expression[], isCollectionMethod?: boolean }[]
}

interface IPropertyMethods {
    identifier?: Identifier;
    parameter?: ParameterExpression;
}

export interface IMappingModel {
    parameter: ParameterExpression;
    model?: EntityType;
    selectStatement?: SelectStatement;
    name: string;
}

export default class ExpressionToSql extends Visitor<ITextQuery> {

    protected readonly scope: ParameterScope = new ParameterScope();

    private readonly selectStack = [] as SelectStatement[];

    constructor(
        private source: EntityQuery,
        public root: ParameterExpression,
        public target: ParameterExpression,
        private compiler: QueryCompiler
    ) {
        super();
        // this.targets.set(root, { parameter: root });
        // this.targets.set(target, { parameter: target, model: this.source?.type });
        if (source?.scope) {
            for (const p of source.scope) {
                this.scope.create({ parameter: p, name: p.name, model: p.model});
            }
        }
        if (this.root) {
            this.scope.create({ parameter: root, name: root.name ?? "x", isRuntimeParam: true });
        }
        if (this.target) {
            this.scope.create({ parameter: target });
        }
    }

    visit(e1: Expression): ITextQuery {
        if(e1.type === "SelectStatement") {
            this.selectStack.push(e1 as SelectStatement);
            const r = super.visit(e1);
            this.selectStack.pop();
            return r;
        }
        return super.visit(e1);
    }

    visitArray(e: Expression[], sep = ","): ITextQuery {
        const r = e.map((x) => this.visit(x));
        return prepareJoin(r, sep);
    }


    visitValuesStatement(e: ValuesStatement): ITextQuery {
        const rows = [];
        for (const rowValues of e.values) {
            rows.push(prepare `(${ this.visitArray(rowValues) })`);
        }
        return prepare `VALUES ${rows}`;

    }

    visitTableLiteral(e: TableLiteral): ITextQuery {
        if (e.schema) {
            return prepare `${this.visit(e.schema)}.${this.visit(e.name)}`;
        }
        return this.visit(e.name);
    }

    visitSelectStatement(e: SelectStatement): ITextQuery {

        this.prepareStatement(e);
        const where = e.where ? prepare `\n\tWHERE ${this.visit(e.where)}` : "";
        const orderBy = e.orderBy?.length > 0 ? prepare `\n\t\tORDER BY ${this.visitArray(e.orderBy)}` : "";
        const limit = e.limit > 0 ? prepare ` LIMIT ${Number(e.limit).toString()}` : "";
        const offset = e.offset > 0 ? prepare ` OFFSET ${Number(e.offset).toString()}` : "";
        const source = /^(Values|Select)Statement/.test(e.source.type)
            ? prepare `(${this.visit(e.source)})`
            : this.visit(e.source);
        const as = e.sourceParameter ? prepare ` AS ${this.scope.nameOf(e.sourceParameter)}` : "";
        const fields = this.visitArray(e.fields, ",\n\t\t");
        const joins = e.joins?.length > 0 ? prepare `\n\t\t${this.visitArray(e.joins, "\n")}` : [];

        return prepare `SELECT
        ${fields}
        FROM ${source}${as}${joins}${where}${orderBy}${limit}${offset}`;
   }
    prepareStatement(e: SelectStatement) {
        // inject parameter and types if we don't have it..
        if (e.sourceParameter && e.model) {
            this.scope.create({ parameter: e.sourceParameter, selectStatement: e });
            // list.push(e.sourceParameter);
        }

        if (e.source?.type === "SelectStatement") {
            this.prepareStatement(e.source);
        }

        const joins = e.joins;
        if (joins?.length) {
            for (const iterator of joins) {
                if (iterator.as) {
                    this.scope.create({ parameter: iterator.as as ParameterExpression, model: iterator.model, selectStatement: e});
                    // list.push(iterator.as as ParameterExpression);
                    if (iterator.source.type === "SelectStatement") {
                        this.prepareStatement(iterator.source);
                    }
                }
            }
            for (const iterator of joins) {
                this.visit(iterator.where);
            }
        }
    }

    visitExpressionAs(e: ExpressionAs): ITextQuery {
        return prepare `${this.visit(e.expression)} AS ${this.visit(e.alias)}`;
    }

    visitConstant({value}: Constant): ITextQuery {
        return [() => value];
    }

    visitBigIntLiteral({ value }: BigIntLiteral): ITextQuery {
        return [value.toString()];
    }

    visitNumberLiteral( { value }: NumberLiteral): ITextQuery {
        return [value.toString()];
    }

    visitStringLiteral({ value }: StringLiteral): ITextQuery {
        const escapeLiteral = this.compiler.escapeLiteral;
        return [escapeLiteral(value)];
    }

    visitBooleanLiteral( { value }: BooleanLiteral): ITextQuery {
        return [ value ? " true ": " false "];
    }

    visitNotExpression(e: NotExpression): ITextQuery {
        return [ " NOT (", this.visit(e.expression) ,  ")"];
    }

    visitNegateExpression(e: NegateExpression): ITextQuery {
        return ["(-", this.visit(e.expression), ")"];
    }

    visitTemplateLiteral(e: TemplateLiteral): ITextQuery {
        const args = this.visitArray(e.value);
        return prepare `CONCAT(${args})`;
    }

    visitBracketExpression(e: BracketExpression): ITextQuery {
        return prepare `(${this.visit(e.target)})`;
    }

    visitCallExpression(e: CallExpression): ITextQuery {
        // let us check if we are using any of array extension methods...
        // .some alias .any
        // .find alias .firstOrDefault
        // if (e.callee.type === "MemberExpression") {
        //     const me = e.callee as MemberExpression;
        //     if (me.target.type === "CallExpression") {
        //         // nested...
        //         const ce = me.target as CallExpression;
        //         const cme = ce.callee as MemberExpression;
        //         if(cme.property.type !== "Identifier") {
        //             throw new EntityAccessError("Invalid expression");
        //         }
        //         const property = cme.property as Identifier;
        //         if(property.value !== "filter") {
        //             throw new EntityAccessError("Invalid expression");
        //         }

        //         filter = e;
        //         e = cme.target as CallExpression;
        //     }
        // }

        const targetProperty = this.getPropertyChain(e.callee as ExpressionType);
        if (targetProperty) {
            const { parameter , identifier, chain } = targetProperty;
            const existingTarget = parameter; // this.scope.get(parameter);
            if (existingTarget) {

                // check if first chain is a filter
                const [firstMember, ... methods] = chain;
                const lastMethod = methods.pop();


                // calling method on property...
                // should be navigation...
                const targetType = existingTarget.model;
                const relation = targetType?.getProperty(firstMember.member);
                if (relation.relation) {

                    const body = e.arguments?.[0] as ExpressionType;
                    if (body?.type === "ArrowFunctionExpression") {
                        if (/^(some|any)$/.test(lastMethod.member)) {
                            const exists = this.expandSome(body, relation, e, parameter, targetType) as ExistsExpression;
                            return this.visit(exists);
                        }
                        if (/^(map|select)$/.test(lastMethod.member) || lastMethod.isCollectionMethod ) {
                            const select = this.expandCollection(relation, e, parameter, targetType);
                            const p1 = body.params[0];
                            this.scope.alias(select.sourceParameter, p1, select);

                            let where = select.where;

                            while(methods.length) {
                                const last = methods.pop();
                                if (last.member !== "filter") {
                                    throw new EntityAccessError(`Invalid method ${last.member}`);
                                }
                                const filterArrow = last.args[0] as ArrowFunctionExpression;
                                this.scope.alias(select.sourceParameter, filterArrow.params[0], select);
                                if (where) {
                                    where = Expression.logicalAnd(where, filterArrow.body);
                                } else {
                                    where = filterArrow.body;
                                }
                            }

                            if (body.body.type === "NewObjectExpression") {
                                const noe = body.body as NewObjectExpression;
                                const fields = noe.properties as ExpressionAs[];
                                return this.visit({ ... select, where, fields } as SelectStatement);
                            }

                            if (lastMethod.isCollectionMethod) {
                                const fields = [
                                    CallExpression.create({
                                        callee: Expression.identifier("Sql.coll." + lastMethod.member),
                                        arguments: [body.body]
                                    })
                                ];
                                return this.visit({ ... select, where, fields } as SelectStatement);
                                }

                            return this.visit({ ... select, where, fields: [
                                body.body
                            ] } as SelectStatement);
                        }
                    }

                    return this.visit(this.expandCollection(relation, e, parameter, targetType));
                }
            }

            const identifierValue = identifier?.value;

            if (identifierValue?.startsWith("Sql")) {
                const argList = e.arguments?.map((x) => this.visit(x)) ?? [];
                const transformedCallee = this.compiler.sqlMethodTransformer(this.compiler, identifierValue, argList.map((al) => al.flat(2)) as any[]);
                if (transformedCallee) {
                    return prepare `${transformedCallee}`;
                }
            }
        }
        const args = this.visitArray(e.arguments);
        return prepare `${this.visit(e.callee)}(${args})`;
    }

    expandCollection(relation: IEntityProperty, e: CallExpression, parameter: ParameterExpression, targetType: EntityType) {
        const relatedModel = relation.relation.relatedEntity;
        const relatedType = relatedModel.typeClass;

        let select: SelectStatement;

        if (this.source?.context) {
            const query = FilteredExpression.isFiltered(e)
                ? this.source.context.query(relatedType)
                : this.source.context.filteredQuery(relatedType, "include", false, targetType.typeClass);
            select = { ...(query as EntityQuery).selectStatement };
            select.fields = [
                NumberLiteral.create({ value: 1 })
            ];
        } else {
            select = relatedModel.selectOneNumber();
        }

        this.scope.create({ parameter: select.sourceParameter, model: relatedModel, selectStatement: select });
        select[filteredSymbol] = true;

        let where = select.where;

        for (const { fkColumn, relatedKeyColumn } of relation.relation.relatedRelation.fkMap) {
            const targetKey = MemberExpression.create({
                target: parameter,
                property: Identifier.create({
                    value: relatedKeyColumn.columnName
                })
            });

            const relatedKey = MemberExpression.create({
                target: select.sourceParameter,
                property: Identifier.create({
                    value: fkColumn.columnName
                })
            });
            const join = Expression.equal(targetKey, relatedKey);
            where = where
                ? Expression.logicalAnd(where, join)
                : join;
        }

        select.where = where;
        return select;
    }

    expandSome(body: ArrowFunctionExpression, relation: IEntityProperty, e: CallExpression, parameter: ParameterExpression, targetType: EntityType) {
        const param1 = body.params[0];
        const relatedModel = relation.relation.relatedEntity;
        const relatedType = relatedModel.typeClass;

        let select: SelectStatement;

        if (this.source?.context) {
            const query = FilteredExpression.isFiltered(e)
                ? this.source.context.query(relatedType)
                : this.source.context.filteredQuery(relatedType, "include", false, targetType.typeClass);
            select = { ...(query as EntityQuery).selectStatement };
            select.fields = [
                NumberLiteral.create({ value: 1 })
            ];
        } else {
            select = relatedModel.selectOneNumber();
        }

        param1.model = relatedModel;
        this.scope.create({ parameter: param1, model: relatedModel, selectStatement: select });
        this.scope.alias(param1, select.sourceParameter, select);
        select.sourceParameter = param1;
        select[filteredSymbol] = true;

        let where = select.where;
        where = where
            ? Expression.logicalAnd(where, body.body)
            : body.body;

        for (const { fkColumn, relatedKeyColumn } of relation.relation.relatedRelation.fkMap) {

            const targetKey = MemberExpression.create({
                target: parameter,
                property: Identifier.create({
                    value: relatedKeyColumn.columnName
                })
            });

            const relatedKey = MemberExpression.create({
                target: param1,
                property: Identifier.create({
                    value: fkColumn.columnName
                })
            });

            const join = Expression.equal(targetKey, relatedKey);

            where = where
                ? Expression.logicalAnd(where, join)
                : join;
        }

        select.where = where;

        const exists = ExistsExpression.create({
            target: select
        });
        return exists;

        // const r = this.visit(exists);
        // this.scope.delete(param1);
        // this.scope.delete(select.sourceParameter);
        // return r;
    }

    visitIdentifier(e: Identifier): ITextQuery {
        if (e.quoted) {
            return [this.compiler.quote(e.value)];
        }
        return [e.value];
    }

    visitParameterExpression(pe: ParameterExpression): ITextQuery {
        const scope = this.scope.get(pe);
        const { value } = scope.parameter;
        const name = this.scope.nameOf(pe);
        if (value !== void 0) {
            return [() => value];
        }
        return [name];
    }

    visitMemberExpression(me: MemberExpression): ITextQuery {
        const propertyChain = this.getPropertyChain(me);
        if (propertyChain) {
            const { parameter, identifier, chain } = propertyChain;
            if (parameter) {
                if (parameter === this.root) {
                    // we have a parameter...
                    return [(p) => p[chain[0].member]];
                }
                if (parameter.value) {
                    const value = parameter.value;
                    return [() => value[chain[0].member]];
                }
                const scope = this.scope.get(parameter);
                if (scope.isRuntimeParam) {
                    return [(p) => p[chain[0].member]];
                }

                const name = this.scope.nameOf(parameter);

                // need to change name as per naming convention here...
                // const namingConvention = this.compiler.namingConvention;
                // if (scope.model && namingConvention) {
                //     chain[0] = namingConvention(chain[0]);
                // }

                return [ QueryParameter.create(() => name) , "." , chain.map((x) => x.member).join(".")];
            }
        }

        const { target, computed, property } = me;

        if (computed) {
            return prepare `${this.visit(target)}[${this.visit(property)}]`;
        }
        return prepare `${this.visit(target)}.${this.visit(property)}`;
    }

    visitNotExists(e: NotExits): ITextQuery {
        return [" NOT EXISTS ", this.visit(e.target) ];
    }

    visitNullExpression(e: NullExpression): ITextQuery {
        return ["NULL"];
    }

    visitBinaryExpression(e: BinaryExpression): ITextQuery {

        let { operator } = e;

        if (operator === "||") {
            operator = "OR";
        }

        if (operator === "&&") {
            operator = "AND";
        }

        // if it has OR .. make all joins LEFT join.
        if (operator === "||" || operator === "OR") {
            if (this.selectStack.length > 0) {
                const last = this.selectStack[this.selectStack.length-1];
                last.preferLeftJoins = true;
                if (last.joins) {
                    for (const iterator of last.joins) {
                        delete iterator.joinType;
                    }
                }
            }
        }

        const left = e.left.type === "BinaryExpression"
            ? prepare `(${this.visit(e.left)})`
            : this.visit(e.left);

        if (operator === "in") {
            operator = "IN";
            if (e.right.type === "ArrayExpression") {
                const ae = e.right as ArrayExpression;
                const rightExpressions = this.visitArray(ae.elements, ",");
                return prepare `${left} IN (${rightExpressions})`;
            }
            const rightExpression = this.visit(e.right);
            return prepare `${left} IN (${(x)=> joinMap(",", x, rightExpression) })`;
        }

        const right = e.right.type === "BinaryExpression"
            ? prepare `(${this.visit(e.right)})`
            : this.visit(e.right);

        if (!e.assign) {
            if ((e.right as ExpressionType).type === "NullExpression") {
                if (operator === "===" || operator === "==" || operator === "=") {
                    return prepare `${left} IS NULL`;
                }
                if (operator === "!==" || operator === "!=" || operator === "<>") {
                    return prepare `${left} IS NOT NULL`;
                }
            }
            if ((e.left as ExpressionType).type === "NullExpression") {
                if (operator === "===" || operator === "==" || operator === "=") {
                    return prepare `${right} IS NULL`;
                }
                if (operator === "!==" || operator === "!=" || operator === "<>") {
                    return prepare `${right} IS NOT NULL`;
                }
            }
        } else {
            switch(operator) {
                case "!==":
                case "!=":
                    operator = "<>";
                    break;
                case "===":
                case "==":
                    operator = "=";
                    break;
            }
        }
        return prepare `${left} ${operator} ${right}`;
    }

    visitConditionalExpression(e: ConditionalExpression): ITextQuery {
        const test = this.visit(e.test);
        const alternate = this.visit(e.alternate);
        const consequent = this.visit(e.consequent);

        return prepare `(CASE WHEN ${test} THEN ${consequent} ELSE ${alternate} END)`;
    }

    visitCoalesceExpression(e: CoalesceExpression): ITextQuery {
        const left = this.visit(e.left);
        const right = this.visit(e.right);
        return prepare `COALESCE(${left}, ${right})`;
    }

    visitReturnUpdated(e: ReturnUpdated): ITextQuery {
        if (!e) {
            return [];
        }
        if (e.fields.length === 0) {
            return [];
        }
        const fields = this.visitArray(e.fields);
        return prepare ` RETURNING ${fields}`;
    }

    visitInsertStatement(e: InsertStatement): ITextQuery {
        const returnValues = e.returnValues ? this.visit(e.returnValues) : [];
        if (e.values instanceof ValuesStatement) {

            const rows = [];
            for (const iterator of e.values.values) {
                const row = this.visitArray(iterator);
                if (row.length === 0) {
                    continue;
                }
                rows.push(prepare `(${ row })`);
            }

            if (rows.length === 0) {
                return prepare `INSERT INTO ${this.visit(e.table)} ${returnValues}`;
            }

            return prepare `INSERT INTO ${this.visit(e.table)} (${this.visitArray(e.values.fields)}) VALUES ${rows} ${returnValues}`;
        }
        return prepare `INSERT INTO ${this.visit(e.table)} ${this.visit(e.values)} ${returnValues}`;

    }

    visitUpdateStatement(e: UpdateStatement): ITextQuery {

        const table = this.visit(e.table);
        let where;
        let set;

        if (e.join) {
            this.scope.create({ parameter: e.sourceParameter, model: e.sourceParameter.model });
            const as = e.join.as as ParameterExpression;
            this.scope.create({ parameter: as, model: as.model });
            const join = this.visit(e.join.source);
            where = this.visit(e.where);
            const joinName = this.scope.nameOf(as);
            const asName = this.scope.nameOf(e.sourceParameter);
            set = this.visitArray(e.set, ",");
            const returning = e.returnUpdated ? [ ` RETURNING `, ... e.returnUpdated.map((r, i) => i
                ? [ `, ${asName}.`, this.visit(r.expression), ` as ${this.visit(r.alias)}`]
                : [ `${asName}.`, this.visit(r.expression), ` as ${this.visit(r.alias)}`]
            ) ] : [];
            return prepare `WITH ${joinName} as (${join}) UPDATE ${table} ${asName} SET ${set} FROM ${joinName} WHERE ${where} ${returning}`;

        }

        where = this.visit(e.where);

        set = this.visitArray(e.set);

        return prepare `UPDATE ${table} SET ${set} WHERE ${where}`;
    }

    visitUpsertStatement(e: UpsertStatement): ITextQuery {
        const table = this.visit(e.table);

        const insertColumns = [];
        const insertValues = [];
        const updateSet = [];

        const compare = [];
        const compareKeys = [];

        for (const { left, right } of e.insert) {
            const c = this.visit(left);
            const v = this.visit(right);
            insertColumns.push(c);
            insertValues.push(v);
        }

        for (const { left, right } of e.update) {
            const c = this.visit(left);
            const v = this.visit(right);
            updateSet.push(prepare `${c} = ${v}`);
        }

        for (const { left, right } of e.keys) {
            const c = this.visit(left);
            const v = this.visit(right);
            compare.push(prepare `${c}=${v}`);
            compareKeys.push(c);
        }

        const returnValues = e.returnUpdated ? this.visit(e.returnUpdated) : [" RETURNING * "];
        /**
         * Postgres does not have any way to do UPSERT without knowing constraint name.
         * Unless we specify the constraints manually, which is overkill. It is better to
         * execute query directly instead of using ORM.
         *
         * We can use type cast in future to fix the issue. As of now it is put on hold.
         */
        return prepare `INSERT INTO ${table} (${prepareJoin(insertColumns)})
            VALUES (${prepareJoin(insertValues)})
            ${returnValues}`;

                // // const r = prepare `INSERT INTO ${table} (${prepareJoin(insertColumns)})
        // //     VALUES (${prepareJoin(insertValues)})
        // //     ON CONFLICT(${prepareJoin(compareKeys)})
        // //     DO UPDATE SET
        // //         ${prepareJoin(updateSet)}
        // //     ${returnValues}`;

        // // return r;


        // if (!updateSet.length) {

        //     if (e.returnUpdated) {

        //         const keys = e.returnUpdated.fields.map((x) => this.visit(x));

        //         return prepare `WITH x AS(
        //             INSERT INTO ${table} (${prepareJoin(insertColumns)})
        //                 VALUES (${prepareJoin(insertValues)})
        //                 ON CONFLICT
        //                 DO NOTHING
        //             ${returnValues}
        //         )
        //         SELECT * FROM x
        //         UNION
        //             SELECT ${prepareJoin(keys)} FROM ${table} WHERE ${prepareJoin(compare, " AND ")}`;
        //     }

        //     return prepare `INSERT INTO ${table} (${prepareJoin(insertColumns)})
        //     VALUES (${prepareJoin(insertValues)})
        //     ON CONFLICT
        //     DO NOTHING`;
        // }

        // // const r = prepare `INSERT INTO ${table} (${prepareJoin(insertColumns)})
        // //     VALUES (${prepareJoin(insertValues)})
        // //     ON CONFLICT(${prepareJoin(compareKeys)})
        // //     DO UPDATE SET
        // //         ${prepareJoin(updateSet)}
        // //     ${returnValues}`;

        // // return r;

        // if (returnValues.length === 0) {
        //     returnValues.push([" RETURNING * "]);
        // }

        // return prepare `
        // WITH U1 AS(
        //         UPDATE ${table} SET
        //             ${prepareJoin(updateSet)}
        //         WHERE ${prepareJoin(compare, " AND ")}
        //         ${returnValues}
        //     ),
        //     I1 AS(
        //         INSERT INTO ${table} (${prepareJoin(insertColumns)})
        //         VALUES (${prepareJoin(insertValues)})
        //         ON CONFLICT
        //         DO UPDATE SET
        //             ${prepareJoin(updateSet)}
        //         ${returnValues}
        //     )
        // SELECT * from U1
        // UNION
        // SELECT * from I1`;
    }

    visitNewObjectExpression(e: NewObjectExpression): ITextQuery {
        return prepare `FROM (${this.visitArray(e.properties)})`;
    }

    visitDeleteStatement(e: DeleteStatement): ITextQuery {
        const table = this.visit(e.table);
        let where;
        if (e.join) {
            this.scope.create({ parameter: e.sourceParameter, model: e.sourceParameter.model });
            const as = e.join.as as ParameterExpression;
            this.scope.create({ parameter: as, model: as.model });
            const join = this.visit(e.join.source);
            where = this.visit(e.join.where);
            const joinName = this.scope.nameOf(as);
            const asName = this.scope.nameOf(e.sourceParameter);
            return prepare `WITH ${joinName} as (${join}) DELETE FROM ${table} as ${asName} USING ${joinName} WHERE ${where}`;
        }

        where = this.visit(e.where);
        return prepare `DELETE FROM ${table} WHERE ${where}`;
    }

    visitJoinExpression(e: JoinExpression): ITextQuery {
        if(!e) {
            return [];
        }
        const table = e.source.type === "SelectStatement" ? prepare `(${this.visit(e.source)})` : this.visit(e.source);
        const where = this.visit(e.where);
        const as = e.as ? prepare ` AS ${ e.as.type === "Identifier"
            ? e.as.value
            : this.scope.nameOf(e.as )}` : "";
        return prepare ` ${e.joinType || "LEFT"} JOIN ${table}${as} ON ${where}`;
    }

    visitOrderByExpression(e: OrderByExpression): ITextQuery {
        if(!e) {
            return [];
        }
        if (e.descending) {
            return prepare `${this.visit(e.target)} DESC`;
        }
        return prepare `${this.visit(e.target)}`;
    }

    visitExistsExpression(e: ExistsExpression): ITextQuery {
        return prepare `EXISTS (${this.visit(e.target)})`;
    }

    visitUnionStatement(e: UnionStatement): ITextQuery {
        const sep = e.all ? " UNION ALL " : " UNION ";
        const all: ITextQuery = ["("];
        let first = true;
        for (const iterator of e.queries) {
            if (!first) {
                all.push(sep);
            } else {
                first = false;
            }
            all.push(this.visit(iterator));
        }
        all.push(")");
        return all;
    }

    private resolveExpression(x: Expression): Expression {

        const targetName = (mep: MemberExpression) => {
            if (mep.target?.type === "MemberExpression") {
                return targetName(mep.target as MemberExpression) + "." + (me.property as Identifier).value;
            }
            return (me.property as Identifier)?.value ?? "";
        };

        if (x.type === "ParameterExpression") {
            const p1 = x as ParameterExpression;
            const scoped = this.scope.get(p1);
            return scoped?.replace ?? p1;
        }
        if (x.type !== "MemberExpression") {
            return x;
        }
        const me = x as MemberExpression;
        const target = this.resolveExpression(me.target);
        if (target.type === "ParameterExpression" && me.property.type === "Identifier") {
            const id = me.property as Identifier;
            if (id.quoted) {
                return;
            }
            const pe = target as ParameterExpression;
            const scope = this.scope.get(pe);
            const peModel = scope?.model;
            if (peModel) {
                const { relation, field } = peModel.getProperty(id.value);
                if (field) {
                    // we need to replace field with column name...
                    return Expression.member(target, field.columnName);
                }
                if (relation) {

                    if (!relation.isCollection) {

                        const targetPath = targetName(me);

                        // let columnName = fkColumn.columnName;
                        // // for inverse relation, we need to
                        // // use primary key of current model
                        // if (relation.isInverseRelation) {
                        //     columnName = peModel.keys[0].columnName;
                        // }

                        const fkMap = relation.fkMap ?? relation.relatedRelation.fkMap;

                        const isNullable = fkMap.some(({ fkColumn }) => fkColumn.nullable);

                        const select = scope?.selectStatement ?? this.source?.selectStatement;
                        if (select) {
                            select.joins ??= [];
                            let join = select.joins.find((j) => j.model === relation.relatedEntity && j.path === targetPath);
                            if (join) {
                                // verify if join exits..
                                this.scope.create({ parameter: join.as as ParameterExpression, model: join.model, selectStatement: select });
                                return join.as;
                            }
                            const joinType = select.preferLeftJoins ? "LEFT" : (isNullable ? "LEFT" : "INNER");
                            const joinParameter = ParameterExpression.create({
                                name: relation.relatedEntity.name[0],
                                model: relation.relatedEntity
                            });
                            let where: Expression;
                            for (const {fkColumn, relatedKeyColumn} of fkMap) {
                                const peColumn = relation.isInverseRelation ? relatedKeyColumn : fkColumn;
                                const joinColumn = relation.isInverseRelation ? fkColumn : relatedKeyColumn;
                                const joinOn = Expression.equal(
                                    Expression.member(pe, peColumn.columnName),
                                    Expression.member(joinParameter, joinColumn.columnName));
                                where = where
                                    ? Expression.logicalAnd(where, joinOn)
                                    : joinOn;
                            }
                            join = JoinExpression.create({
                                as: joinParameter,
                                joinType,
                                model: joinParameter.model,
                                source: Expression.identifier(relation.relatedEntity.name),
                                path: targetPath,
                                where
                            });
                            select.joins.push(join);
                            this.scope.create({ parameter: joinParameter, model: relation.relatedEntity, selectStatement: select});
                            return join.as;
                        }
                    }

                }
            }
        }
        if (target !== me.target) {
            // parameter is replaced...
            return MemberExpression.create({ target, property: me.property, isCollectionMethod: me.isCollectionMethod });
        }
        return x;
    }

    /**
     * This will also create and replace joins if query is provided.
     * @param x MemberExpression
     * @returns Property Chain
     */
    private getPropertyChain(x: Expression): IPropertyChain {

        const resolved = this.resolveExpression(x);

        if (!resolved) {
            return;
        }

        if (resolved.type === "MemberExpression") {
            x = resolved;
        }

        const chain = [] as { member: string, args?: Expression[], isCollectionMethod?: boolean}[];
        while (x) {
            if (x.type === "ParameterExpression") {
                return { parameter: x as ParameterExpression, chain };
            }
            if (x.type === "Identifier") {
                return { identifier: x as Identifier, chain };
            }
            if (x.type === "MemberExpression") {
                const me = x as MemberExpression;
                x = me.target;
                chain.unshift({ member: (me.property as Identifier).value , isCollectionMethod: me.isCollectionMethod });
                continue;
            }
            if (x.type === "CallExpression") {
                const ce = x as CallExpression;
                const me = ce.callee.type === "MemberExpression" && ce.callee as MemberExpression;
                if (!me) {
                    throw new EntityAccessError("Invalid call expression");
                }
                x = me.target;
                if (x.type === "MemberExpression") {
                    x = this.resolveExpression(x) ?? x;
                }
                chain.splice(0, 0, { member: (me.property as Identifier).value, isCollectionMethod: me.isCollectionMethod, args: ce.arguments });
                continue;
            }
            throw new EntityAccessError(`Invalid expression expression ${x.type}`);
        }

        throw new NotSupportedError();

        // const chain = [];
        // let me = (x as ExpressionType).type === "MemberExpression"
        //     ? x as MemberExpression
        //     : void 0;
        // while(me) {

        //     const target = me.target as ExpressionType;

        //     const property = me.property as ExpressionType;
        //     if (property.type !== "Identifier") {
        //         return;
        //     }
        //     chain.unshift(property.value);
        //     if (target === this.root) {
        //         return { parameter: target, chain };
        //     }
        //     if (target.type === "ParameterExpression") {
        //         return { parameter: target, chain };
        //     }
        //     if (target.type === "Identifier") {
        //         return { identifier: target, chain };
        //     }
        //     me = target.type === "MemberExpression"
        //         ? target as MemberExpression
        //         : void 0;
        // };
    }

    // private flatten(pc: IPropertyChain) : IPropertyChain {

    //     if (!pc) {
    //         return pc;
    //     }

    //     // check if we have parameter..
    //     let { parameter } = pc;
    //     if (!parameter) {
    //         return pc;
    //     }
    //     if (pc.chain.length <= 1) {
    //         return pc;
    //     }

    //     const chain = [ ... pc.chain];

    //     const scope = this.scope.get(parameter);
    //     const select = scope?.selectStatement ?? this.source?.selectStatement;
    //     if (!select) {
    //         return pc;
    //     }
    //     let type = select.model;

    //     select.joins ??= [];

    //     while(chain.length > 1) {
    //         const property = chain.shift();
    //         const propertyInfo = type.getProperty(property);
    //         if (!propertyInfo.relation || propertyInfo.relation.isInverseRelation) {
    //             return pc;
    //         }

    //         const relation = propertyInfo.relation;
    //         // check if relation is optional...
    //         if (!relation.fkColumn) {
    //             return pc;
    //         }

    //         const { fkColumn } = relation;

    //         const join = select.joins.find((x) => x.model === relation.relatedEntity);
    //         if (!join) {
    //             const joinType = fkColumn.nullable ? "LEFT" : "INNER";
    //             const joinParameter = ParameterExpression.create({ name: relation.relatedEntity.name[0]});
    //             joinParameter.model = relation.relatedEntity;
    //             select.joins.push(JoinExpression.create({
    //                 as: joinParameter,
    //                 joinType,
    //                 model: joinParameter.model,
    //                 source: Expression.identifier(relation.relatedEntity.name),
    //                 where: Expression.equal(
    //                     Expression.member(parameter, fkColumn.columnName),
    //                     Expression.member(joinParameter, relation.relatedEntity.keys[0].columnName)
    //                 )
    //             }));
    //             parameter = joinParameter;
    //             type = relation.relatedEntity;
    //             this.scope.create({ parameter, model: type, selectStatement: select });
    //             pc.parameter = parameter;
    //             pc.chain = [ ... chain ];
    //         } else {
    //             // we will add parameter in scope in case if it is not there
    //             // this is the case when query is composed over already existing
    //             // there is still an error on this one...
    //             pc.parameter = parameter = join.as as ParameterExpression;
    //             type = join.model;
    //             pc.chain = [... chain];
    //             this.scope.create({ parameter, model: type, selectStatement: select });
    //         }
    //     }

    //     return pc;
    // }

}
