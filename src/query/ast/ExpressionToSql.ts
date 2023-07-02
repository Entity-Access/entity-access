import QueryCompiler from "../../compiler/QueryCompiler.js";
import type EntityType from "../../entity-query/EntityType.js";
import type EntityContext from "../../model/EntityContext.js";
import { EntitySource } from "../../model/EntitySource.js";
import { BigIntLiteral, BinaryExpression, BooleanLiteral, CallExpression, CoalesceExpression, Constant, DeleteStatement, ExistsExpression, Expression, ExpressionAs, ExpressionType, Identifier, InsertStatement, JoinExpression, MemberExpression, NullExpression, NumberLiteral, OrderByExpression, PlaceholderExpression, QuotedLiteral, ReturnUpdated, SelectStatement, StringLiteral, TableLiteral, TemplateLiteral, UpdateStatement, ValuesStatement } from "./Expressions.js";
import { ITextOrFunctionArray, prepare, prepareJoin } from "./IStringTransformer.js";
import Visitor from "./Visitor.js";

export interface IEntitySource {
    model: EntityType;
    context: EntityContext;
}

export default class ExpressionToSql extends Visitor<ITextOrFunctionArray> {

    private targets: Map<string, IEntitySource> = new Map();

    constructor(
        type: EntitySource,
        private root: string,
        target: string,
        private compiler: QueryCompiler
    ) {
        super();
        this.targets.set(target, type as any as IEntitySource);
    }

    visitArray(e: Expression[], sep = ","): ITextOrFunctionArray {
        const r = e.map((x) => this.visit(x));
        return prepareJoin(r, sep);
    }


    visitValuesStatement(e: ValuesStatement): ITextOrFunctionArray {
        const rows = [];
        for (const rowValues of e.values) {
            rows.push(prepare `(${ this.visitArray(rowValues) })`);
        }
        return prepare `VALUES ${rows}`;

    }

    visitTableLiteral(e: TableLiteral): ITextOrFunctionArray {
        if (e.schema) {
            return prepare `${this.visit(e.schema)}.${this.visit(e.name)}`;
        }
        return this.visit(e.name);
    }

    visitSelectStatement(e: SelectStatement): ITextOrFunctionArray {
        const fields = this.visitArray(e.fields);
        const joins = e.joins?.length > 0 ? prepare ` ${this.visitArray(e.joins)}` : [];
        const orderBy = e.orderBy?.length > 0 ? prepare ` ORDER BY ${this.visitArray(e.orderBy)}` : "";
        const source = this.visit(e.source);
        const where = e.where ? prepare ` WHERE ${this.visit(e.where)}` : "";
        const as = e.as ? prepare ` AS ${this.visit(e.as)}` : "";
        return prepare `SELECT ${fields} FROM ${source}${as}${joins}${where}${orderBy}`;
    }

    visitQuotedLiteral(e: QuotedLiteral): ITextOrFunctionArray {
        return [this.compiler.quotedLiteral(e.literal)];
    }

    visitExpressionAs(e: ExpressionAs): ITextOrFunctionArray {
        return prepare `${this.visit(e.expression)} AS ${this.visit(e.alias)}`;
    }

    visitConstant({value}: Constant): ITextOrFunctionArray {
        return [() => value];
    }

    visitBigIntLiteral({ value }: BigIntLiteral): ITextOrFunctionArray {
        return [() => value];
    }

    visitNumberLiteral( { value }: NumberLiteral): ITextOrFunctionArray {
        return [() => value];
    }

    visitStringLiteral({ value }: StringLiteral): ITextOrFunctionArray {
        const escapeLiteral = this.compiler.escapeLiteral;
        return [() => escapeLiteral(value)];
    }

    visitBooleanLiteral( { value }: BooleanLiteral): ITextOrFunctionArray {
        return [ () => value ? "1" : "0" ];
    }

    visitTemplateLiteral(e: TemplateLiteral): ITextOrFunctionArray {
        const args = this.visitArray(e.value);
        return prepare `CONCAT(${args})`;
    }

    visitCallExpression(e: CallExpression): ITextOrFunctionArray {
        // let us check if we are using any of array extension methods...
        // .some alias .any
        // .find alias .firstOrDefault

        const targetProperty = this.getPropertyChain(e.callee as ExpressionType);
        if (targetProperty?.length) {
            const [ target , property, childProperty ] = targetProperty;
            const existingTarget = this.targets.get(target);
            if (existingTarget) {


                // calling method on property...
                // should be navigation...
                const targetType = existingTarget.model;
                const context = existingTarget.context;
                const relation = targetType?.getProperty(property);
                if (relation) {
                    if (/^(some|any)$/i.test(childProperty)) {

                        const relatedSource = context.model.register(relation.relation.relatedTypeClass) as any as IEntitySource;
                        const relatedModel = relatedSource.model;

                        const body = e.arguments[0] as ExpressionType;
                        if (body.type === "ArrowFunctionExpression") {

                            const param1 = body.params[0] as Identifier;

                            const dispose = this.pushTarget(param1.value, relatedSource);

                            const targetKey = MemberExpression.create({
                                target: Identifier.create({ value: target }),
                                property: Identifier.create({
                                    value: targetType.keys[0].columnName
                                })
                            });

                            const relatedKey = MemberExpression.create({
                                target: Identifier.create({ value: param1.value }),
                                property: Identifier.create({
                                    value: relation.relation.fkColumn.columnName
                                })
                            });

                            const exists = ExistsExpression.create({
                                target: SelectStatement.create({
                                    source: relatedModel.fullyQualifiedName,
                                    as: QuotedLiteral.create({ literal: param1.value}),
                                    fields: [
                                        ExpressionAs.create({ expression: NumberLiteral.create({ value: 1 }),
                                        alias: QuotedLiteral.create({ literal: param1.value + "1" })
                                    })],
                                    where: BinaryExpression.create({
                                        left: BinaryExpression.create({
                                            left: targetKey,
                                            operator: "=",
                                            right: relatedKey,
                                        }),
                                        operator: "AND",
                                        right:body.body
                                    })
                                })
                            });

                            const r = this.visit(exists);
                            dispose();
                            return r;
                        }

                    }
                }
            }

            if (target === "Sql") {
                const names = `${target}.${property}.${childProperty}`;
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

    visitIdentifier(e: Identifier): ITextOrFunctionArray {
        // need to visit parameters
        return [e.value];
    }

    visitMemberExpression(me: MemberExpression): ITextOrFunctionArray {
        const chain = this.getPropertyChain(me);
        if (chain) {
            const [root, key ] = chain;
            if (root === this.root) {
                // we have a parameter...
                return [(p) => p[key]];
            }
            if (this.targets.has(root)) {
                // we have column name from table parameter
                // we need to set quoted literal...
                const all = chain.map((x) => this.compiler.quotedLiteral(x)).join(".");
                return [all];
            }
        }

        const { target, computed, property } = me;

        if (computed) {
            return prepare `${this.visit(target)}[${this.visit(property)}]`;
        }
        return prepare `${this.visit(target)}.${this.visit(property)}`;
    }

    visitNullExpression(e: NullExpression): ITextOrFunctionArray {
        return ["NULL"];
    }

    visitBinaryExpression(e: BinaryExpression): ITextOrFunctionArray {
        return prepare `(${this.visit(e.left)} ${e.operator} ${this.visit(e.right)})`;
    }

    visitCoalesceExpression(e: CoalesceExpression): ITextOrFunctionArray {
        const left = this.visit(e.left);
        const right = this.visit(e.right);
        return prepare `COALESCE(${left}, ${right})`;
    }

    visitReturnUpdated(e: ReturnUpdated): ITextOrFunctionArray {
        if (!e) {
            return [];
        }
        if (e.fields.length === 0) {
            return [];
        }
        const fields = this.visitArray(e.fields).join(",");
        return prepare ` RETURNING ${fields}`;
    }

    visitInsertStatement(e: InsertStatement): ITextOrFunctionArray {
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

            return prepare `INSERT INTO ${this.visit(e.table)} (${this.visitArray(e.values.fields)}) VALUES ${rows.join(",")} ${returnValues}`;
        }
        return prepare `INSERT INTO ${this.visit(e.table)} ${this.visit(e.values)} ${returnValues}`;

    }

    visitUpdateStatement(e: UpdateStatement): ITextOrFunctionArray {

        const table = this.visit(e.table);

        const where = this.visit(e.where);

        const set = this.visitArray(e.set);

        return prepare `UPDATE ${table} SET ${set.join(",")} WHERE ${where}`;
    }

    visitDeleteStatement(e: DeleteStatement): ITextOrFunctionArray {
        const table = this.visit(e.table);
        const where = this.visit(e.where);
        return prepare `DELETE ${table} WHERE ${where}`;
    }

    visitJoinExpression(e: JoinExpression): ITextOrFunctionArray {
        if(!e) {
            return [];
        }
        const table = this.visit(e.source);
        const where = this.visit(e.where);
        return prepare ` ${e.joinType || "LEFT"} JOIN ${table} ON ${where}`;
    }

    visitOrderByExpression(e: OrderByExpression): ITextOrFunctionArray {
        if(!e) {
            return [];
        }
        if (e.descending) {
            return prepare `${this.visit(e.target)} DESC`;
        }
        return prepare `${this.visit(e.target)}`;
    }

    visitExistsExpression(e: ExistsExpression): ITextOrFunctionArray {
        return prepare `EXISTS (${this.visit(e.target)})`;
    }

    visitPlaceholderExpression(e: PlaceholderExpression): ITextOrFunctionArray {
        const p = e.expression();
        return prepare `${p}`;
    }

    private pushTarget(target: string, type: IEntitySource) {
        this.targets.set(target, type);
        return () => this.targets.delete(target);
    }

    private getPropertyChain(x: Expression) {
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
            chain.push(property.value);
            if (target.type === "Identifier") {
                chain.push(target.value);
                break;
            }
            start = target;
        } while (true);
        return chain.reverse();
    }


}
