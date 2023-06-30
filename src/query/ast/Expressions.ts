import { IColumn } from "../../decorators/IColumn.js";
import { IClassOf } from "../../decorators/IClassOf.js";

export class Expression {

    static create<T extends Expression>(this: IClassOf<T>, p: Partial<Omit<T, "type">>) {
        (p as any).type = (this as any).name;
        Object.setPrototypeOf(p, this.prototype);
        return p as T;
    }

    readonly type: never | string;

}

export class BinaryExpression {

    readonly type = "BinaryExpression";

    left: Expression;
    right: Expression;
    operator: string;
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

export class CreateTableStatement extends Expression {
    readonly type = "CreateTableStatement";

    table: TableLiteral;

    columns: IColumn;
}

const All = [
    BinaryExpression,
    ValuesStatement,
    SelectStatement,
    Constant,
    QuotedLiteral,
    ExpressionAs,
    TableLiteral,
    InsertStatement,
    CreateTableStatement,
    UpdateStatement,
    DeleteStatement
];

export type ExpressionType = InstanceType<(typeof All)[0]>;