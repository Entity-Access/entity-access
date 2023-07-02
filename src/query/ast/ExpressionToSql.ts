import { BigIntLiteral, BinaryExpression, BooleanLiteral, CallExpression, CoalesceExpression, Constant, DeleteStatement, ExistsExpression, Expression, ExpressionAs, ExpressionType, Identifier, InsertStatement, JoinExpression, MemberExpression, NullExpression, NumberLiteral, OrderByExpression, QuotedLiteral, ReturnUpdated, SelectStatement, StringLiteral, TableLiteral, TemplateLiteral, UpdateStatement, ValuesStatement } from "./Expressions.js";
import { ISqlMethodTransformer, IStringTransformer } from "./IStringTransformer.js";
import SqlLiteral from "./SqlLiteral.js";
import Visitor from "./Visitor.js";

export default class ExpressionToSql extends Visitor<string> {

    public values: string[] = [];

    constructor(
        private root: string,
        private target: string,
        private quotedLiteral: IStringTransformer = JSON.stringify,
        private escapeLiteral: IStringTransformer = SqlLiteral.escapeLiteral,
        private sqlMethodTranslator: ISqlMethodTransformer = (x, y) => void 0
    ) {
        super();
    }

    visitValuesStatement(e: ValuesStatement): string {
        const rows = [];
        for (const rowValues of e.values) {
            const row = this.visitArray(rowValues);
            rows.push(`(${row.join(",")})`);
        }
        return `VALUES ${rows.join(",")}`;
    }

    visitTableLiteral(e: TableLiteral): string {
        if (e.schema) {
            return `${this.visit(e.schema)}.${this.visit(e.name)}`;
        }
        return this.visit(e.name);
    }

    visitSelectStatement(e: SelectStatement): string {
        const fields = this.visitArray(e.fields).join(",");
        const joins = e.joins?.length > 0 ?  this.visitArray(e.joins) : "";
        const orderBy = e.orderBy?.length > 0 ? ` ORDER BY ${this.visitArray(e.orderBy)}` : "";
        const source = this.visit(e.source);
        const where = e.where ? ` WHERE ${this.visit(e.where)}` : "";
        return `SELECT ${fields} FROM ${source} ${joins} ${where} ${orderBy}`;
    }

    visitQuotedLiteral(e: QuotedLiteral): string {
        return this.quotedLiteral(e.literal);
    }

    visitExpressionAs(e: ExpressionAs): string {
        return `${this.visit(e.expression)} AS ${this.visit(e.alias)}`;
    }

    visitConstant(e: Constant): string {
        this.values.push(e.value);
        return "$" + this.values.length;
    }

    visitBigIntLiteral(e: BigIntLiteral): string {
        return e.value.toString();
    }

    visitNumberLiteral(e: NumberLiteral): string {
        return e.value.toString();
    }

    visitStringLiteral(e: StringLiteral): string {
        return this.escapeLiteral(e.value);
    }

    visitBooleanLiteral(e: BooleanLiteral): string {
        return e.value ? "1" : "0";
    }

    visitTemplateLiteral(e: TemplateLiteral): string {
        const args = this.visitArray(e.value);
        return `CONCAT(${args.join(", ")})`;
    }

    visitCallExpression(e: CallExpression): string {
        const args = this.visitArray(e.arguments);
        // let us check if we are using any of array extension methods...
        // .some alias .any
        // .find alias .firstOrDefault

        const targetProperty = this.getPropertyChain(e.callee as ExpressionType);
        if (targetProperty?.length) {
            const [ target , property, childProperty ] = targetProperty;
            if (target === this.target) {


                // calling method on property...
                // should be navigation...
                // @ts-expect-error private
                const targetType = this.source.model;
                // @ts-expect-error private
                const context = this.source.context;
                const relation = targetType?.getProperty(property);
                if (relation) {
                    if (/^(some|any)$/i.test(childProperty)) {

                        const relatedSource = context.model.register(relation.relation.relatedTypeClass);
                    }
                }
            }
        }

        const callee = this.visit(e.callee);
        const transformedCallee = this.sqlMethodTranslator(callee, args);
        if (transformedCallee) {
            return transformedCallee;
        }
        return `${this.visit(e.callee)}(${args.join(",")})`;
    }

    visitIdentifier(e: Identifier): string {
        // need to visit parameters
        return e.value;
    }

    visitMemberExpression({ target, computed, property }: MemberExpression): string {
        const identifier = target as Identifier;
        if (identifier.type === "Identifier") {
            if (identifier.value === this.root) {
                // we have a parameter...
                this.values.push(this.visit(property));
                return "$" + this.values.length;
            }
            if (identifier.value === this.target) {
                // we have column name from table parameter
                // we need to set quoted literal...
                return `${this.quotedLiteral(this.target)}.${this.quotedLiteral(this.visit(property))}`;
            }
        }

        if (computed) {
            return `${this.visit(target)}[${this.visit(property)}]`;
        }
        return `${this.visit(target)}.${this.visit(property)}`;
    }

    visitNullExpression(e: NullExpression): string {
        return "NULL";
    }

    visitBinaryExpression(e: BinaryExpression): string {
        return `(${this.visit(e.left)} ${e.operator} ${this.visit(e.right)})`;
    }

    visitCoalesceExpression(e: CoalesceExpression): string {
        const left = this.visit(e.left);
        const right = this.visit(e.right);
        return `COALESCE(${left}, ${right})`;
    }

    visitReturnUpdated(e: ReturnUpdated): string {
        if (!e) {
            return "";
        }
        if (e.fields.length === 0) {
            return "";
        }
        const fields = this.visitArray(e.fields).join(",");
        return ` RETURNING ${fields}`;
    }

    visitInsertStatement(e: InsertStatement): string {
        const returnValues = this.visit(e.returnValues);
        if (e.values instanceof ValuesStatement) {

            const rows = [];
            for (const iterator of e.values.values) {
                const row = this.visitArray(iterator);
                if (row.length === 0) {
                    continue;
                }
                rows.push("(" + row.join(",") + ")");
            }

            if (rows.length === 0) {
                return `INSERT INTO ${this.visit(e.table)} ${returnValues}`;
            }

            return `INSERT INTO ${this.visit(e.table)} (${this.walkJoin(e.values.fields)}) VALUES ${rows.join(",")} ${returnValues}`;
        }
        return `INSERT INTO ${this.visit(e.table)} ${this.visit(e.values)} ${returnValues}`;

    }

    visitUpdateStatement(e: UpdateStatement): string {

        const table = this.visit(e.table);

        const where = this.visit(e.where);

        const set = this.visitArray(e.set);

        return `UPDATE ${table} SET ${set.join(",")} WHERE ${where}`;
    }

    visitDeleteStatement(e: DeleteStatement): string {
        const table = this.visit(e.table);
        const where = this.visit(e.where);
        return `DELETE ${table} WHERE ${where}`;
    }

    visitJoinExpression(e: JoinExpression): string {
        if(!e) {
            return "";
        }
        const table = this.visit(e.source);
        const where = this.visit(e.where);
        return ` ${e.joinType || "LEFT"} JOIN ${table} ON ${where}`;
    }

    visitOrderByExpression(e: OrderByExpression): string {
        if(!e) {
            return "";
        }
        if (e.descending) {
            return `${this.visit(e.target)} DESC`;
        }
        return `${this.visit(e.target)}`;
    }

    visitExistsExpression(e: ExistsExpression): string {
        return `EXISTS (${this.visit(e.target)})`;
    }

    walkJoin(e: Expression[], sep = ",\r\n\t"): string {
        return e.map((i) => this.visit(i)).join(sep);
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


    private getTargetPropertyIdentifier(x: ExpressionType): { property?: string, childProperty?: string } {
        if (x.type !== "MemberExpression") {
            return;
        }

        const target = x.target as ExpressionType;
        const property = x.property as ExpressionType;
        if(property.type !== "Identifier") {
            return;
        }

        if (target.type === "Identifier"
            && target.value === this.target) {
            return { property: property.value };
        }

        if (target.type !== "MemberExpression") {
            return;
        }

        const root = target.target as ExpressionType;
        if (root.type !== "Identifier" || root.value !== this.target) {
            return;
        }

        const childProperty = property.value;
        const parentProperty= target as ExpressionType;
        if(parentProperty.type !== "Identifier") {
            return;
        }

        return { property: parentProperty.value, childProperty };
    }


}
