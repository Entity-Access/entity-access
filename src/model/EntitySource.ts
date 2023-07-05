import type EntityContext from "./EntityContext.js";
import type EntityType from "../entity-query/EntityType.js";
import type { IEntityQuery, IFilterExpression } from "./IFilterWithParameter.js";
import { BinaryExpression, Expression, ExpressionAs, PlaceholderExpression, QuotedLiteral, SelectStatement, TableLiteral } from "../query/ast/Expressions.js";
import EntityQuery from "./EntityQuery.js";
import TimedCache from "../common/cache/TimedCache.js";
import { contextSymbol, modelSymbol } from "../common/symbols/symbols.js";
import { SourceExpression } from "./SourceExpression.js";
import { IClassOf } from "../decorators/IClassOf.js";

const modelCache = new TimedCache<any, SelectStatement>();

export class EntitySource<T = any> {


    public readonly filters: {
        read?: () => IFilterExpression;
        modify?: () => IFilterExpression;
        delete?: () => IFilterExpression;
        include?: (parent: IClassOf<any>) => IFilterExpression;
    } = {};


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
        const { model, context } = this;
        const select = modelCache.getOrCreate(`select-model-${this.model.name}`, () => this.generateModel());
        return new EntityQuery<T>(SourceExpression.create({
            alias: select.as.literal,
            context,
            model,
            select
        })) as IEntityQuery<T>;
    }

    public where<P>(...[parameter, fx]: IFilterExpression<P, T>) {
        const { model, context } = this;
        let select = modelCache.getOrCreate(`select-model-${this.model.name}`, () => this.generateModel());

        // assign default read filter
        const filter = this.filters.read?.();
        if ( filter) {
            select = { ... select, where: PlaceholderExpression.create({ expression: () => filter}) };
        }

        return new EntityQuery<T>(SourceExpression.create({
            alias: select.as.literal,
            context,
            model,
            select
        })).where(parameter, fx) as IEntityQuery<T>;
    }

    generateModel(): SelectStatement {
        const source = this.model.fullyQualifiedName;
        const as = QuotedLiteral.create({ literal: this.model.name[0] + "1" });
        const fields = this.model.columns.map((c) => c.name !== c.columnName
            ? ExpressionAs.create({
                expression: QuotedLiteral.propertyChain(as.literal, c.columnName),
                alias: QuotedLiteral.create({ literal: c.name })
            })
            : QuotedLiteral.propertyChain(as.literal, c.columnName));
        return SelectStatement.create({
            source,
            as,
            fields,
        });
    }

    public toQuery() {
        const filter = this.filter;
        if(!filter) {
            return "";
        }
        return this.context.driver.compiler.compileExpression(filter);
    }
}
