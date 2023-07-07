import type EntityContext from "./EntityContext.js";
import type EntityType from "../entity-query/EntityType.js";
import type { IEntityQuery, IFilterExpression } from "./IFilterWithParameter.js";
import { Expression, ExpressionAs, QuotedLiteral, SelectStatement } from "../query/ast/Expressions.js";
import EntityQuery from "./EntityQuery.js";
import TimedCache from "../common/cache/TimedCache.js";
import { contextSymbol, modelSymbol } from "../common/symbols/symbols.js";
import { SourceExpression } from "./SourceExpression.js";

const modelCache = new TimedCache<any, SelectStatement>();

export class EntitySource<T = any> {

    get [modelSymbol]() {
        return this.model;
    }

    get[contextSymbol]() {
        return this.context;
    }

    private filter: Expression;

    constructor(
        private readonly model: EntityType,
        private readonly context: EntityContext
    ) {

    }

    public add(item: Partial<T>) {
        const p = Object.getPrototypeOf(item).constructor;
        if (!p || p === Object) {
            Object.setPrototypeOf(item, this.model.typeClass.prototype);
        }
        const entry = this.context.changeSet.getEntry(item);
        if (entry.status !== "detached" && entry.status !== "unchanged") {
            throw new Error("Entity is already attached to the context");
        }
        entry.status = "inserted";
        return entry.entity;
    }

    /**
     * Entity can only be deleted if all primary keys are present
     * @param item entity to delete
     */
    public delete(item: Partial<T>) {
        const p = Object.getPrototypeOf(item).constructor;
        if (!p || p === Object) {
            Object.setPrototypeOf(item, this.model.typeClass.prototype);
        }
        const entry = this.context.changeSet.getEntry(item);
        if (entry.status !== "detached" && entry.status !== "unchanged") {
            throw new Error("Entity is already attached to the context");
        }
        entry.status = "deleted";
        return entry.entity;
    }

    public all(): IEntityQuery<T> {
        return this.asQuery();
    }

    public where<P>(...[parameter, fx]: IFilterExpression<P, T>) {
        return this.asQuery().where(parameter, fx);
    }

    generateModel(): SelectStatement {
        const source = this.model.fullyQualifiedName;
        const as = Expression.parameter(this.model.name[0] + "1");
        const fields = this.model.columns.map((c) => c.name !== c.columnName
            ? ExpressionAs.create({
                expression: Expression.member(as, c.columnName),
                alias: QuotedLiteral.create({ literal: c.name })
            })
            : Expression.member(as, c.columnName));
        return SelectStatement.create({
            source,
            as,
            fields,
        });
    }

    public asQuery() {
        const { model, context } = this;
        const select = modelCache.getOrCreate(`select-model-${this.model.name}`, () => this.generateModel());
        return new EntityQuery<T>(SourceExpression.create({
            alias: select.as,
            context,
            model,
            select
        })) as any as IEntityQuery<T>;

    }

    public toQuery() {
        const filter = this.filter;
        if(!filter) {
            return "";
        }
        return this.context.driver.compiler.compileExpression(filter);
    }
}
