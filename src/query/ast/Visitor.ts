import { BinaryExpression, Constant, DeleteStatement, Expression, ExpressionAs, ExpressionType, InsertStatement, JoinExpression, OrderByExpression, QuotedLiteral, ReturnUpdated, SelectStatement, TableLiteral, UpdateStatement, ValuesStatement } from "./Expressions.js";


export default abstract class Visitor<T = any> {

    visitArray(ea: Expression[]) {
        const r = [];
        for (const iterator of ea) {
            r.push(this.visit(iterator));
        }
        return r;
    }

    visit(e1: Expression): T {

        const e = e1 as ExpressionType;

        switch (e.type) {
            case "InsertStatement":
                return this.visitInsertStatement(e);
            case "Constant":
                return this.visitConstant(e);
            case "ExpressionAs":
                return this.visitExpressionAs(e);
            case "QuotedLiteral":
                return this.visitQuotedLiteral(e);
            case "SelectStatement":
                return this.visitSelectStatement(e);
            case "TableLiteral":
                return this.visitTableLiteral(e);
            case "ValuesStatement":
                return this.visitValuesStatement(e);
            case "CreateTableStatement":
                return this.visitCreateTableStatement();
            case "BinaryExpression":
                return this.visitBinaryExpression(e);
            case "UpdateStatement":
                return this.visitUpdateStatement(e);
            case "DeleteStatement":
                return this.visitDeleteStatement(e);
            case "ReturnUpdated":
                return this.visitReturnUpdated(e);
            case "OrderByExpression":
                return this.visitOrderByExpression(e);
            case "JoinExpression":
                return this.visitJoinExpression(e);
        }
        const c: never = e;
        throw new Error("Not implemented");
    }

    visitJoinExpression(e: JoinExpression): T {
        return;
    }

    visitOrderByExpression(e: OrderByExpression): T {
        return;
    }

    visitReturnUpdated(e: ReturnUpdated): T {
        return;
    }

    visitDeleteStatement(e: DeleteStatement): T {
        return;
    }

    visitUpdateStatement(e: UpdateStatement): T {
        return;
    }

    visitBinaryExpression(e: BinaryExpression): T {
        return;
    }

    visitCreateTableStatement(): T {
        return;
    }

    visitValuesStatement(e: ValuesStatement): T {
        return;
    }

    visitTableLiteral(e: TableLiteral): T {
        return;
    }

    visitSelectStatement(e: SelectStatement): T {
        return;
    }

    visitQuotedLiteral(e: QuotedLiteral): T {
        return;
    }

    visitExpressionAs(e: ExpressionAs): T {
        return;
    }

    visitConstant(e: Constant): T {
        return;
    }

    visitInsertStatement(e: InsertStatement): T {
        return;
    }

}
