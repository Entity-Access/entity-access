import ExpressionToSql from "../../query/ast/ExpressionToSql.js";
import { BooleanLiteral, DeleteStatement, InsertStatement, NumberLiteral, OrderByExpression, ParameterExpression, ReturnUpdated, SelectStatement, UpdateStatement, UpsertStatement, ValuesStatement } from "../../query/ast/Expressions.js";
import { ITextQuery, prepare, prepareJoin } from "../../query/ast/IStringTransformer.js";

export default class ExpressionToSqlServer extends ExpressionToSql {

    visitReturnUpdated(e: ReturnUpdated): ITextQuery {
        if (!e) {
            return [];
        }
        if (e.fields.length === 0) {
            return [];
        }
        const fields = [];
        let i = 0;
        for (const iterator of e.fields) {
            if (i++) {
                fields.push(",");
            }
            fields.push(prepare `${e.changes}.${this.visit(iterator)}`);
        }
        return prepare ` OUTPUT ${fields}`;
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

            return prepare `INSERT INTO ${this.visit(e.table)} (${this.visitArray(e.values.fields)}) ${returnValues} VALUES ${rows}`;
        }
        return prepare `INSERT INTO ${this.visit(e.table)} ${returnValues} ${this.visit(e.values)}`;

    }

    visitUpsertStatement(e: UpsertStatement): ITextQuery {
        const table = this.visit(e.table);

        const insertColumns = [];
        const insertValues = [];
        const updateSet = [];

        const compare = [];

        const keys = [];

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
            compare.push(prepare `${c} = ${v}`);
            keys.push(c);
        }

        const returnValues = e.returnUpdated ? this.visit(e.returnUpdated) : [];

        if (!updateSet.length) {

            if (e.returnUpdated) {

                const fields = e.returnUpdated.fields.map((x) => this.visit(x));

                return prepare `
                    SELECT ${prepareJoin(fields)} FROM ${table}
                    WHERE ${prepareJoin(compare, " AND ")};
                    IF @@ROWCOUNT=0
                    BEGIN
                        INSERT INTO ${table} (${prepareJoin(insertColumns)})
                        ${returnValues}
                        SELECT * FROM (VALUES (${prepareJoin(insertValues)})) as A(${prepareJoin(insertColumns)})
                        WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE ${prepareJoin(compare, " AND ")});
                    END
                `;
            }
            return prepare ` SELECT ${prepareJoin(keys)} FROM ${table}
                WHERE ${prepareJoin(compare, " AND ")};
                IF @@ROWCOUNT=0
                BEGIN
                    INSERT INTO ${table} (${prepareJoin(insertColumns)})
                    SELECT * FROM (VALUES (${prepareJoin(insertValues)})) as A(${prepareJoin(insertColumns)})
                    WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE ${prepareJoin(compare, " AND ")});
                END;`;
    }

        return prepare `
            UPDATE ${table}
            SET
                ${prepareJoin(updateSet)}
                ${returnValues}
            WHERE ${prepareJoin(compare, " AND ")};
            IF @@ROWCOUNT=0
            BEGIN
                INSERT INTO ${table} (${prepareJoin(insertColumns)})
                ${returnValues}
                SELECT * FROM (VALUES (${prepareJoin(insertValues)})) as A(${prepareJoin(insertColumns)})
                WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE ${prepareJoin(compare, " AND ")});
            END;`;
    }


    visitSelectStatement(e: SelectStatement): ITextQuery {

        this.prepareStatement(e);

        const orderBy = e.orderBy?.length > 0 ? prepare `\n\t\tORDER BY ${this.visitArray(e.orderBy)}` : "";
        const where = e.where ? prepare `\n\tWHERE ${this.visit(e.where)}` : "";

        const fields = this.visitArray(e.fields, ",\n\t\t");
        const joins = e.joins?.length > 0 ? prepare `\n\t\t${this.visitArray(e.joins, "\n")}` : [];

        const showTop = e.limit && !e.offset;
        const showFetch = e.limit && e.offset;

        if (e.limit && e.offset) {
            if (!e.orderBy?.length) {
                // lets set default order by... if not set...
                // as sql server needs something to order by...
                e.orderBy = [
                    OrderByExpression.create({  target:  NumberLiteral.one  })
                ];
            }
        }

        const topValue = Number(e.limit);
        const top = showTop ? prepare ` TOP (${() => topValue}) ` : "";

        let source: ITextQuery;
        let as: ITextQuery | "";
        if (e.source.type === "ValuesStatement") {
            const v = e.source as ValuesStatement;
            const rows = v.values.map((x) => prepare `(${this.visitArray(x)})`);
            source  = prepare `(VALUES ${rows}) as ${this.visit(e.sourceParameter)}(${this.visitArray(v.fields)})`;
            as = [];
        } else {
            source = this.visit(e.source);
            as = e.sourceParameter ? prepare ` AS ${this.visit(e.sourceParameter)}` : "";
        }

        // const as = e.as ? prepare ` AS ${this.visit(e.as)}` : "";
        const offset = showFetch ? prepare ` OFFSET ${Number(e.offset).toString()} ROWS ` : "";
        const next = showFetch ? prepare ` FETCH NEXT ${Number(e.limit).toString()} ROWS ONLY` : "";
        return prepare `SELECT ${top}
        ${fields}
        FROM ${source}${as}${joins}${where}${orderBy}${offset}${next}`;
    }

    visitValuesStatement(e: ValuesStatement): ITextQuery {
        const rows = [];
        for (const rowValues of e.values) {
            rows.push(prepare `(${ this.visitArray(rowValues) })`);
        }
        const fields = e.fields ? prepare ` as x11(${this.visitArray(e.fields)})` : "";
        return prepare `(VALUES ${rows}) ${fields}`;

    }

    visitDeleteStatement(e: DeleteStatement): ITextQuery {
        const table = this.visit(e.table);
        if (e.join) {
            this.scope.create({ parameter: e.sourceParameter, model: e.sourceParameter.model })
            const as = e.join.as as ParameterExpression;
            this.scope.create({ parameter: as, model: as.model })
            const join = this.visit(e.join.source);
            const where = this.visit(e.join.where);
            const joinName = this.scope.nameOf(as);
            const asName = this.scope.nameOf(e.sourceParameter);
            return prepare `WITH ${joinName} as (${join}) DELETE ${asName} FROM ${table} as ${asName} INNER JOIN ${joinName} ON ${where}`;
        }

        const where = this.visit(e.where);
        return prepare `DELETE FROM ${table} WHERE ${where}`;
    }

    visitUpdateStatement(e: UpdateStatement): ITextQuery {
        if (e.join) {
            const table = this.visit(e.table);
            this.scope.create({ parameter: e.sourceParameter, model: e.sourceParameter.model })
            const as = e.join.as as ParameterExpression;
            this.scope.create({ parameter: as, model: as.model })
            const join = this.visit(e.join.source);
            const where = this.visit(e.where);
            const joinName = this.scope.nameOf(as);
            const asName = this.scope.nameOf(e.sourceParameter);
            const set = this.visitArray(e.set, ",");
            return prepare `WITH ${joinName} as (${join}) UPDATE ${asName} SET ${set} FROM ${table} AS ${asName} INNER JOIN ${joinName} ON ${where}`;
        }
        return super.visitUpdateStatement(e);
    }

    visitBooleanLiteral({ value }: BooleanLiteral): ITextQuery {
        return value ? [ " 1 "] : [ " 0 "];
    }
}