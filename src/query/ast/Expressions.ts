import { IColumn } from "../../decorators/IColumn.js";
import { IClassOf } from "../../decorators/IClassOf.js";
import { ITextOrFunctionArray } from "./IStringTransformer.js";
import type EntityType from "../../entity-query/EntityType.js";

const flattenedSelf = Symbol("flattenedSelf");

/**
 * The reason we are using our own Expression type is to keep
 * our expressions small and independent of JavaScript ESTree style.
 *
 * Reason is simple, our visitor pattern can be small and can stay
 * independent of any other extra expression types.
 *
 * We will cache our expressions, to avoid parsing them multiple times.
 * Our expressions do not need to store exact line numbers, comments,
 * extra annotations. We can add some shortcut optimizations which might
 * not be possible with outer libraries unless they support it.
 *
 * In future, we might make our own expression parser as we only need
 * handful of features to keep it small and faster. Or we can swap some
 * other JavaScript parser without affecting our code generation process.
 */

export abstract class Expression {

    static create<T extends Expression>(this: IClassOf<T>, p: Partial<Omit<T, "type">>) {
        (p as any).type = (this as any).name;
        Object.setPrototypeOf(p, this.prototype);
        return p as T;
    }

    static clone<T extends Expression>(expression: T): T {
        const r = {} as any;
        Object.setPrototypeOf(r, Object.getPrototypeOf(expression));
        for (const key in expression) {
            if (Object.prototype.hasOwnProperty.call(expression, key)) {
                const element = expression[key];
                if(Array.isArray(element)) {
                    r[key] = element.map((x) => this.clone(x));
                } else {
                    r[key] = element;
                }
            }
        }
        return r as T;
    }

    private static shallowCopy(expression, constants: Expression[]) {
        const copy = {} as any;
        for (const key in expression) {
            if (Object.prototype.hasOwnProperty.call(expression, key)) {
                const element = expression[key];
                if (key === "type" || key === "is") {
                    continue;
                }
                if (element instanceof Constant) {
                    constants.push(element);
                }
                copy[key] = element;
            }
        }
        Object.setPrototypeOf(copy, Object.getPrototypeOf(expression));
        return copy;
    }

    readonly type: never | string;

}

export class PlaceholderExpression extends Expression {
    readonly type = "PlaceholderExpression";
    expression: () => ITextOrFunctionArray;
}

export class BinaryExpression extends Expression {

    readonly type = "BinaryExpression";

    left: Expression;
    right: Expression;
    operator: string;
}

export class CoalesceExpression extends Expression {
    readonly type = "CoalesceExpression";
    left: Expression;
    right: Expression;
}

export class ValuesStatement extends Expression {
    readonly type = "ValuesStatement";
    as: QuotedLiteral;
    fields: QuotedLiteral[];
    values: Expression[][];
}

export class OrderByExpression extends Expression {
    readonly type = "OrderByExpression";
    target: Expression;
    descending: boolean;
}

export class ExistsExpression extends Expression {
    readonly type = "ExistsExpression";
    target: Expression;
}

export class CallExpression extends Expression {
    readonly type = "CallExpression";
    callee: Expression;
    arguments: Expression[];
}

export class MemberExpression extends Expression {
    readonly type = "MemberExpression";
    target: Expression;
    property: Expression;
    computed: boolean;
}

export class ArrowFunctionExpression extends Expression {
    readonly type = "ArrowFunctionExpression";
    params: Expression[];
    body: Expression;
}

export type TableSource = SelectStatement | QuotedLiteral | ExpressionAs | TableLiteral;

export class SelectStatement extends Expression {

    readonly type = "SelectStatement";

    source: TableSource;

    as: QuotedLiteral;

    fields: (Expression | QuotedLiteral | ExpressionAs)[];

    where: Expression;

    orderBy: OrderByExpression[];

    joins: JoinExpression[];

}

export class JoinExpression extends Expression {
    readonly type = "JoinExpression";
    joinType: "LEFT" | "INNER";
    source: SelectStatement | QuotedLiteral | ExpressionAs;
    as: QuotedLiteral;
    where: Expression;
    model: EntityType;
}

export class ReturnUpdated extends Expression {
    readonly type = "ReturnUpdated";

    fields: QuotedLiteral[];

    changes: "INSERTED" | "DELETED" | "UPDATED";
}

export class Constant extends Expression {
    readonly type = "Constant";
    public value: any;
}

export class Identifier extends Expression {
    readonly type = "Identifier";
    public value: string;
}

export class NullExpression extends Expression {
    readonly type = "NullExpression";
}

export class StringLiteral extends Expression {
    readonly type = "StringLiteral";
    public value: string;
}

export class BooleanLiteral extends Expression {
    readonly type = "BooleanLiteral";
    public value: boolean;
}

export class NumberLiteral extends Expression {
    readonly type = "NumberLiteral";
    public value: number;
}

export class BigIntLiteral extends Expression {
    readonly type = "BigIntLiteral";
    public value: bigint;
}

export class TemplateLiteral extends Expression {
    readonly type = "TemplateLiteral";
    public value: Expression[];
}

export class QuotedLiteral extends Expression {

    static propertyChain(... properties: string[]): Expression {
        const literal = properties.pop();
        const property = QuotedLiteral.create({ literal });
        if (properties.length === 0) {
            return property;
        }
        return MemberExpression.create({
            target: QuotedLiteral.propertyChain(... properties),
            property
        });
    }

    readonly type = "QuotedLiteral";
    public literal: string;
}

export class ExpressionAs extends Expression {
    readonly type = "ExpressionAs";
    expression: Expression;
    alias: QuotedLiteral;
}

export class TableLiteral extends Expression {
    readonly type = "TableLiteral";
    schema: QuotedLiteral;
    name: QuotedLiteral;

}

export class InsertStatement extends Expression {
    readonly type = "InsertStatement";
    table: TableLiteral;

    values: ValuesStatement | SelectStatement;

    returnValues: ReturnUpdated;

}

export class UpdateStatement extends Expression {

    readonly type = "UpdateStatement";

    table: TableLiteral;

    set: BinaryExpression[];

    where: Expression;

}

export class DeleteStatement extends Expression {
    readonly type = "DeleteStatement";
    table: TableLiteral;
    where: Expression;
}

export type ExpressionType =
    BinaryExpression |
    ValuesStatement |
    SelectStatement |
    Constant|
    QuotedLiteral|
    ExpressionAs|
    TableLiteral|
    InsertStatement|
    UpdateStatement|
    DeleteStatement|
    ReturnUpdated|
    OrderByExpression|
    JoinExpression|
    NullExpression|
    StringLiteral|
    NumberLiteral|
    BigIntLiteral|
    BooleanLiteral|
    TemplateLiteral|
    MemberExpression|
    CallExpression|
    CoalesceExpression|
    ExistsExpression|
    Identifier |
    PlaceholderExpression|
    ArrowFunctionExpression
;
