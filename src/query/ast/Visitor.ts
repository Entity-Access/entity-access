import { BigIntLiteral, BinaryExpression, BooleanLiteral, CallExpression, CoalesceExpression, Constant, DeleteStatement, ExistsExpression, Expression, ExpressionAs, ExpressionType, Identifier, InsertStatement, JoinExpression, MemberExpression, NullExpression, NumberLiteral, OrderByExpression, QuotedLiteral, ReturnUpdated, SelectStatement, StringLiteral, TableLiteral, TemplateLiteral, UpdateStatement, ValuesStatement } from "./Expressions.js";


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
            case "Null":
                return this.visitNullExpression(e);
            case "BigInt":
                return this.visitBigIntLiteral(e);
            case "Boolean":
                return this.visitBooleanLiteral(e);
            case "Number":
                return this.visitNumberLiteral(e);
            case "String":
                return this.visitStringLiteral(e);
            case "Template":
                return this.visitTemplateLiteral(e);
            case "MemberExpression":
                return this.visitMemberExpression(e);
            case "CallExpression":
                return this.visitCallExpression(e);
            case "Identifier":
                return this.visitIdentifier(e);
            case "CoalesceExpression":
                return this.visitCoalesceExpression(e);
            case "ExistsExpression":
                return this.visitExistsExpression(e);
        }
        const c: never = e;
        throw new Error("Not implemented");
    }
    visitExistsExpression(e: ExistsExpression): T {
        return;
    }
    visitCoalesceExpression(e: CoalesceExpression): T {
        return;
    }
    visitIdentifier(e: Identifier): T {
        return;
    }
    visitCallExpression(e: CallExpression): T {
        return;
    }
    visitMemberExpression(e: MemberExpression): T {
        return;
    }
    visitTemplateLiteral(e: TemplateLiteral): T {
        return;
    }
    visitStringLiteral(e: StringLiteral): T {
        return;
    }
    visitNumberLiteral(e: NumberLiteral): T {
        return;
    }
    visitBooleanLiteral(e: BooleanLiteral): T {
        return;
    }
    visitBigIntLiteral(e: BigIntLiteral): T {
        return;
    }
    visitNullExpression(e: NullExpression): T {
        return;
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
