import QueryCompiler from "../../compiler/QueryCompiler.js";
import EntityQuery from "../../model/EntityQuery.js";
import { SourceExpression } from "../../model/SourceExpression.js";
import { BigIntLiteral, BinaryExpression, BooleanLiteral, CallExpression, CoalesceExpression, ConditionalExpression, Constant, DeleteStatement, ExistsExpression, Expression, ExpressionAs, ExpressionType, Identifier, InsertStatement, JoinExpression, MemberExpression, NewObjectExpression, NullExpression, NumberLiteral, OrderByExpression, ParameterExpression, QuotedLiteral, ReturnUpdated, SelectStatement, StringLiteral, TableLiteral, TemplateLiteral, UpdateStatement, ValuesStatement } from "./Expressions.js";
import { ITextQuery, QueryParameter, prepare, prepareJoin } from "./IStringTransformer.js";
import Visitor from "./Visitor.js";

export default class ExpressionToSql extends Visitor<ITextQuery> {

    private targets: Map<ParameterExpression, SourceExpression> = new Map();

    constructor(
        private source: SourceExpression,
        public root: ParameterExpression,
        public target: ParameterExpression,
        private compiler: QueryCompiler
    ) {
        super();
        if (source) {
            source.parameter = target;
        }
        this.targets.set(root, source ?? null);
        this.targets.set(target, source ?? null);
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
        const fields = this.visitArray(e.fields, ",\n\t\t");
        const orderBy = e.orderBy?.length > 0 ? prepare `\n\t\tORDER BY ${this.visitArray(e.orderBy)}` : "";
        const source = this.visit(e.source);
        const where = e.where ? prepare `\n\tWHERE ${this.visit(e.where)}` : "";
        const as = e.as ? prepare ` AS ${this.visit(e.as)}` : "";
        const joins = e.joins?.length > 0 ? prepare `\n\t\t${this.visitArray(e.joins)}` : [];
        const limit = e.limit > 0 ? prepare ` LIMIT ${Number(e.limit).toString()}` : "";
        const offset = e.offset > 0 ? prepare ` OFFSET ${Number(e.offset).toString()}` : "";
        return prepare `SELECT
        ${fields}
        FROM ${source}${as}${joins}${where}${orderBy}${limit}${offset}`;
    }

    visitQuotedLiteral(e: QuotedLiteral): ITextQuery {
        return [this.compiler.quotedLiteral(e.literal)];
    }

    visitExpressionAs(e: ExpressionAs): ITextQuery {
        return prepare `${this.visit(e.expression)} AS ${this.visit(e.alias)}`;
    }

    visitConstant({value}: Constant): ITextQuery {
        return [() => value];
    }

    visitBigIntLiteral({ value }: BigIntLiteral): ITextQuery {
        return [() => value];
    }

    visitNumberLiteral( { value }: NumberLiteral): ITextQuery {
        return [() => value];
    }

    visitStringLiteral({ value }: StringLiteral): ITextQuery {
        const escapeLiteral = this.compiler.escapeLiteral;
        return [() => escapeLiteral(value)];
    }

    visitBooleanLiteral( { value }: BooleanLiteral): ITextQuery {
        return [ () => value ? "1" : "0" ];
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
            const existingTarget = this.targets.get(parameter);
            if (existingTarget) {


                // calling method on property...
                // should be navigation...
                const targetType = existingTarget.model;
                const context = existingTarget.context;
                const relation = targetType?.getProperty(chain[0]);
                if (relation) {
                    if (/^(some|any)$/i.test(chain[1])) {


                        const body = e.arguments[0] as ExpressionType;
                        if (body.type === "ArrowFunctionExpression") {

                            const param1 = body.params[0];
                            const relatedSource = this.source.addSource(relation.relation.relatedEntity, param1);
                            const relatedModel = relatedSource.model;
                            const targetKey = MemberExpression.create({
                                target: this.target,
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

                            let query = this.source.context.query(relatedSource.model.typeClass);

                            // check if we have filter...
                            const entityEvents = this.source.context.eventsFor(relatedSource.model.typeClass, false);
                            if (entityEvents) {
                                query = entityEvents.includeFilter(query);
                            }

                            let select = (query as EntityQuery).selectStatement;


                            const join = BinaryExpression.create({
                                left: targetKey,
                                operator: "=",
                                right: relatedKey
                            });

                            let where = select.where;

                            if(where) {
                                where = BinaryExpression.create({
                                    left: select.where,
                                    operator: "AND",
                                    right: join
                                });
                            } else {
                                where = join;
                            }

                            select = { ... select, where };

                            select.fields = [
                                Identifier.create({ value: "1"})
                            ];

                            const exists = ExistsExpression.create({
                                target: select
                            });

                            const dispose = this.pushTarget(param1.value, SourceExpression.create({
                                context,
                                select,
                                parameter: param1.value,
                                alias: select.as,
                                model: relatedModel,
                                parent: this.source
                            }));

                            const r = this.visit(exists);
                            dispose();
                            return r;
                        }

                    }
                }
            }

            if (identifier?.value === "Sql") {
                const names = `${identifier.value}.${chain.join(".")}`;
                const argList = e.arguments.map((x) => this.visit(x));
                const transformedCallee = this.compiler.sqlMethodTransformer(names, argList as any[]);
                if (transformedCallee) {
                    return prepare `${transformedCallee}`;
                }
            }
        }
        const args = this.visitArray(e.arguments);
        return prepare `${this.visit(e.callee)}(${args})`;
    }

    visitIdentifier(e: Identifier): ITextQuery {
        // need to visit parameters
        return [e.value];
    }

    visitParameterExpression({ name, value }: ParameterExpression): ITextQuery {
        if (value !== void 0) {
            return [() => value];
        }
        return [name];
    }

    visitMemberExpression(me: MemberExpression): ITextQuery {
        const propertyChain = this.getPropertyChain(me);
        if (propertyChain) {
            const { parameter, identifier, chain } = propertyChain;
            if (parameter === this.root) {
                // we have a parameter...
                return [(p) => p[chain[0]]];
            }
            const source = this.targets.get(parameter);
            if (source) {
                return [source.flatten(chain)];
            }
            return [ QueryParameter.create(() => parameter.name, this.compiler.quotedLiteral) , "." , chain.map((x) => this.compiler.quotedLiteral(x)).join(".")];
        }

        const { target, computed, property } = me;

        if (computed) {
            return prepare `${this.visit(target)}[${this.visit(property)}]`;
        }
        return prepare `${this.visit(target)}.${this.visit(property)}`;
    }

    visitNullExpression(e: NullExpression): ITextQuery {
        return ["NULL"];
    }

    visitBinaryExpression(e: BinaryExpression): ITextQuery {
        const left = e.left.type === "BinaryExpression"
            ? prepare `(${this.visit(e.left)})`
            : this.visit(e.left);
        const right = e.right.type === "BinaryExpression"
            ? prepare `(${this.visit(e.right)})`
            : this.visit(e.right);
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
        const as = e.as ? prepare ` AS ${this.visit(e.as)}` : "";
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

    private pushTarget(target: ParameterExpression, type: SourceExpression) {
        this.targets.set(target, type);
        return () => this.targets.delete(target);
    }

    private getPropertyChain(x: Expression): { identifier?: Identifier, parameter?: ParameterExpression, chain: string[] } {
        const chain = [];
        let start = x as ExpressionType;
        do {

            if (start.type !== "MemberExpression") {
                return;
            }

            const target = start.target as ExpressionType;
            const property = start.property as ExpressionType;
            if (property.type !== "Identifier") {
                return;
            }
            chain.unshift(property.value);
            if (target.type === "ParameterExpression") {
                // chain.unshift(target);
                if(!this.targets.has(target)) {
                    return;
                }
                return { parameter: target, chain };
            }
            if (target.type === "Identifier") {
                return { identifier: target, chain };
            }
            start = target;
        } while (true);
    }


}
