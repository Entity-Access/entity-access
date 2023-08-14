import EntityAccessError from "../../common/EntityAccessError.js";
import { DisposableScope } from "../../common/usingAsync.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import EntityType, { IEntityProperty } from "../../entity-query/EntityType.js";
import EntityQuery from "../../model/EntityQuery.js";
import { FilteredExpression, filteredSymbol } from "../../model/events/FilteredExpression.js";
import { NotSupportedError } from "../parser/NotSupportedError.js";
import { ArrowFunctionExpression, BigIntLiteral, BinaryExpression, BooleanLiteral, CallExpression, CoalesceExpression, ConditionalExpression, Constant, DeleteStatement, ExistsExpression, Expression, ExpressionAs, ExpressionType, Identifier, InsertStatement, JoinExpression, MemberExpression, NewObjectExpression, NotExits, NullExpression, NumberLiteral, OrderByExpression, ParameterExpression, ReturnUpdated, SelectStatement, StringLiteral, TableLiteral, TemplateLiteral, UnionAllStatement, UpdateStatement, ValuesStatement } from "./Expressions.js";
import { ITextQuery, QueryParameter, prepare, prepareJoin } from "./IStringTransformer.js";
import ParameterScope from "./ParameterScope.js";
import Visitor from "./Visitor.js";

interface IPropertyChain {
    identifier?: Identifier,
    parameter?: ParameterExpression,
    chain: string[]
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
        const source = e.source.type === "ValuesStatement"
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

        const joins = e.joins;
        if (joins?.length) {
            for (const iterator of joins) {
                if (iterator.as) {
                    this.scope.create({ parameter: iterator.as as ParameterExpression, model: iterator.model, selectStatement: e});
                    // list.push(iterator.as as ParameterExpression);
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

    visitTemplateLiteral(e: TemplateLiteral): ITextQuery {
        const args = this.visitArray(e.value);
        return prepare `CONCAT(${args})`;
    }

    visitCallExpression(e: CallExpression): ITextQuery {
        // let us check if we are using any of array extension methods...
        // .some alias .any
        // .find alias .firstOrDefault

        const targetProperty = this.getPropertyChain(e.callee as ExpressionType);
        if (targetProperty) {
            const { parameter , identifier, chain } = targetProperty;
            const existingTarget = parameter; // this.scope.get(parameter);
            if (existingTarget) {


                // calling method on property...
                // should be navigation...
                const targetType = existingTarget.model;
                const relation = targetType?.getProperty(chain[0]);
                if (relation) {

                    const body = e.arguments?.[0] as ExpressionType;
                    if (body?.type === "ArrowFunctionExpression") {
                        const exists = this.expandSome(body, relation, e, parameter, targetType) as ExistsExpression;
                        if (/^(some|any)$/.test(chain[1])) {
                            return this.visit(exists);
                        }
                        if (/^(map|select)$/.test(chain[1])) {
                            const select = this.expandCollection(relation, e, parameter, targetType);
                            const noe = body.body as NewObjectExpression;
                            const p1 = body.params[0];
                            this.scope.alias(select.sourceParameter, p1, select);
                            const fields = noe.properties as ExpressionAs[];
                            return this.visit({ ... select, fields } as SelectStatement);
                        }
                    }

                    return this.visit(this.expandCollection(relation, e, parameter, targetType));
                }
            }

            if (identifier?.value === "Sql") {
                const argList = e.arguments?.map((x) => this.visit(x)) ?? [];
                const transformedCallee = this.compiler.sqlMethodTransformer(this.compiler, chain, argList as any[]);
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
                : this.source.context.filteredQuery(relatedType, "include", false);
            select = { ...(query as EntityQuery).selectStatement };
            select.fields = [
                NumberLiteral.create({ value: 1 })
            ];
        } else {
            select = relatedModel.selectOneNumber();
        }

        this.scope.create({ parameter: select.sourceParameter, model: relatedModel, selectStatement: select });
        select[filteredSymbol] = true;
        const targetKey = MemberExpression.create({
            target: parameter,
            property: Identifier.create({
                value: targetType.keys[0].columnName
            })
        });

        const relatedKey = MemberExpression.create({
            target: select.sourceParameter,
            property: Identifier.create({
                value: relation.relation.fkColumn.columnName
            })
        });


        const join = Expression.equal(targetKey, relatedKey);

        let where = select.where;

        if (where) {
            where = BinaryExpression.create({
                left: select.where,
                operator: "AND",
                right: join
            });
        } else {
            where = join;
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
                : this.source.context.filteredQuery(relatedType, "include", false);
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
        const targetKey = MemberExpression.create({
            target: parameter,
            property: Identifier.create({
                value: targetType.keys[0].columnName
            })
        });

        const relatedKey = MemberExpression.create({
            target: param1,
            property: Identifier.create({
                value: relation.relation.fkColumn.columnName
            })
        });


        const join = Expression.logicalAnd(
            Expression.equal(targetKey, relatedKey),
            body.body
        );

        let where = select.where;

        if (where) {
            where = BinaryExpression.create({
                left: select.where,
                operator: "AND",
                right: join
            });
        } else {
            where = join;
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
        // need to visit parameters
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
                    return [(p) => p[chain[0]]];
                }
                if (parameter.value) {
                    const value = parameter.value;
                    return [() => value[chain[0]]];
                }
                const scope = this.scope.get(parameter);
                if (scope.isRuntimeParam) {
                    return [(p) => p[chain[0]]];
                }
                const name = this.scope.nameOf(parameter);

                // need to change name as per naming convention here...
                const namingConvention = this.compiler.namingConvention;
                if (scope.model && namingConvention) {
                    chain[0] = namingConvention(chain[0]);
                }

                return [ QueryParameter.create(() => name) , "." , chain.join(".")];
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

        // if it has OR .. make all joins LEFT join.
        if (e.operator === "||" || e.operator === "OR") {
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
        const right = e.right.type === "BinaryExpression"
            ? prepare `(${this.visit(e.right)})`
            : this.visit(e.right);

        if ((e.right as ExpressionType).type === "NullExpression") {
            if (e.operator === "===" || e.operator === "==" || e.operator === "=") {
                return prepare `${left} IS NULL`;
            }
            if (e.operator === "!==" || e.operator === "!=" || e.operator === "<>") {
                return prepare `${left} IS NOT NULL`;
            }
        }
        if ((e.left as ExpressionType).type === "NullExpression") {
            if (e.operator === "===" || e.operator === "==" || e.operator === "=") {
                return prepare `${right} IS NULL`;
            }
            if (e.operator === "!==" || e.operator === "!=" || e.operator === "<>") {
                return prepare `${right} IS NOT NULL`;
            }
        }
        return prepare `${left} ${e.operator} ${right}`;
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
        const fields = this.visitArray(e.fields).join(",");
        return prepare ` RETURNING ${fields}`;
    }

    visitInsertStatement(e: InsertStatement): ITextQuery {
        const returnValues = this.visit(e.returnValues);
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

        const where = this.visit(e.where);

        const set = this.visitArray(e.set);

        return prepare `UPDATE ${table} SET ${set} WHERE ${where}`;
    }

    visitNewObjectExpression(e: NewObjectExpression): ITextQuery {
        return prepare `FROM (${this.visitArray(e.properties)})`;
    }

    visitDeleteStatement(e: DeleteStatement): ITextQuery {
        const table = this.visit(e.table);
        const where = this.visit(e.where);
        return prepare `DELETE FROM ${table} WHERE ${where}`;
    }

    visitJoinExpression(e: JoinExpression): ITextQuery {
        if(!e) {
            return [];
        }
        const table = this.visit(e.source);
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

    visitUnionAllStatement(e: UnionAllStatement): ITextQuery {
        const all: ITextQuery = [];
        let first = true;
        for (const iterator of e.queries) {
            all.push(this.visit(iterator));
            if (first) {
                first = false;
                continue;
            }
            all.push(" UNION ALL ");
        }
        return all;
    }

    private resolveExpression(x: Expression): Expression {
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
            const pe = target as ParameterExpression;
            const scope = this.scope.get(pe);
            const peModel = scope?.model;
            if (peModel) {
                const { relation } = peModel.getProperty(id.value);
                if (relation) {

                    const { fkColumn } = relation;

                    if (!relation.isCollection) {

                        let columnName = fkColumn.columnName;
                        // for inverse relation, we need to
                        // use primary key of current model
                        if (relation.isInverseRelation) {
                            columnName = peModel.keys[0].columnName;
                        }

                        const select = scope?.selectStatement ?? this.source?.selectStatement;
                        if (select) {
                            select.joins ??= [];
                            let join = select.joins.find((j) => j.model === relation.relatedEntity);
                            if (join) {
                                // verify if join exits..
                                return join.as;
                            }
                            const joinType = select.preferLeftJoins ? "LEFT" : (fkColumn.nullable ? "LEFT" : "INNER");
                            const joinParameter = ParameterExpression.create({ name: relation.relatedEntity.name[0]});
                            joinParameter.model = relation.relatedEntity;
                            join = JoinExpression.create({
                                as: joinParameter,
                                joinType,
                                model: joinParameter.model,
                                source: Expression.identifier(relation.relatedEntity.name),
                                where: Expression.equal(
                                    Expression.member(pe, columnName),
                                    Expression.member(joinParameter, relation.relatedEntity.keys[0].columnName)
                                )
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
            return MemberExpression.create({ target, property: me.property });
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

        if (resolved.type === "MemberExpression") {
            x = resolved;
        }

        const chain = [];
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
                chain.unshift((me.property as Identifier).value);
            }
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

    private flatten(pc: IPropertyChain) : IPropertyChain {

        if (!pc) {
            return pc;
        }

        // check if we have parameter..
        let { parameter } = pc;
        if (!parameter) {
            return pc;
        }
        if (pc.chain.length <= 1) {
            return pc;
        }

        const chain = [ ... pc.chain];

        const scope = this.scope.get(parameter);
        const select = scope?.selectStatement ?? this.source?.selectStatement;
        if (!select) {
            return pc;
        }
        let type = select.model;

        select.joins ??= [];

        while(chain.length > 1) {
            const property = chain.shift();
            const propertyInfo = type.getProperty(property);
            if (!propertyInfo.relation || propertyInfo.relation.isInverseRelation) {
                return pc;
            }

            const relation = propertyInfo.relation;
            // check if relation is optional...
            if (!relation.fkColumn) {
                return pc;
            }

            const { fkColumn } = relation;

            const join = select.joins.find((x) => x.model === relation.relatedEntity);
            if (!join) {
                const joinType = fkColumn.nullable ? "LEFT" : "INNER";
                const joinParameter = ParameterExpression.create({ name: relation.relatedEntity.name[0]});
                joinParameter.model = relation.relatedEntity;
                select.joins.push(JoinExpression.create({
                    as: joinParameter,
                    joinType,
                    model: joinParameter.model,
                    source: Expression.identifier(relation.relatedEntity.name),
                    where: Expression.equal(
                        Expression.member(parameter, fkColumn.columnName),
                        Expression.member(joinParameter, relation.relatedEntity.keys[0].columnName)
                    )
                }));
                parameter = joinParameter;
                type = relation.relatedEntity;
                this.scope.create({ parameter, model: type});
                pc.parameter = parameter;
                pc.chain = [ ... chain ];
            } else {
                // we will add parameter in scope in case if it is not there
                // this is the case when query is composed over already existing
                // there is still an error on this one...
                pc.parameter = parameter = join.as as ParameterExpression;
                type = join.model;
                pc.chain = [... chain];
                if (!this.scope.get(parameter)) {
                    this.scope.create({ parameter, model: type });
                }
            }
        }

        return { parameter, chain };
    }

}
