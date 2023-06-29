import { IClassOf } from "../../decorators/IClassOf.js";

export class Expression {

    readonly type: never | string;

    static create<T extends Expression>(this: IClassOf<T>, p: Partial<Omit<T, "type">>) {
        (p as any).type = (this as any).name;
        Object.setPrototypeOf(p, this.prototype);
        return p as T;
    }

}

export class ValuesStatement extends Expression {
    readonly type = "ValuesStatement";
    as: QuotedLiteral;
    fields: QuotedLiteral[];
    values: Expression[][];
}

export class SelectStatement extends Expression {

    readonly type = "SelectStatement";

    source: SelectStatement | QuotedLiteral | ExpressionAs;

    as: QuotedLiteral;

    fields: ExpressionAs[];

    where: Expression;

}

export class Constant extends Expression {
    readonly type = "Constant";
    public value: any;
}

export class QuotedLiteral extends Expression {
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

    exports: QuotedLiteral[];

}

const All = [
    ValuesStatement,
    SelectStatement,
    Constant,
    QuotedLiteral,
    ExpressionAs,
    TableLiteral,
    InsertStatement
];

export type ExpressionType = InstanceType<(typeof All)[0]>;