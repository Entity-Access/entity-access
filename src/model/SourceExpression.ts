import { modelSymbol } from "../common/symbols/symbols.js";
import EntityType from "../entity-query/EntityType.js";
import { BinaryExpression, Expression, ExpressionAs, Identifier, JoinExpression, MemberExpression, QuotedLiteral, SelectStatement } from "../query/ast/Expressions.js";
import { ITextQueryFragment, QueryParameter } from "../query/ast/IStringTransformer.js";
import EntityContext from "./EntityContext.js";

const sourceSymbol = Symbol("source");

export class SourceExpression {

    public static create(p: Partial<SourceExpression>) {
        return new SourceExpression(p);
    }

    signal: AbortSignal;
    alias: string;
    parameter?: string;
    context: EntityContext;
    model?: EntityType;
    include?: EntityType[];
    select: SelectStatement;
    parent?: SourceExpression;

    private map: Map<string,SourceExpression>;
    private paramMap: Map<string, SourceExpression>;

    private constructor(p: Partial<SourceExpression>) {
        Object.setPrototypeOf(p, SourceExpression.prototype);
        const r = p as SourceExpression;
        if (r.parent) {
            r.map = r.parent.map;
            r.paramMap = r.parent.paramMap;
        } else {
            r.paramMap = new Map();
            r.map = new Map();
        }
        return r;
    }

    copy() {
        const r = { ... this } as SourceExpression;
        Object.setPrototypeOf(r, Object.getPrototypeOf(this));
        r.map = new Map(this.map.entries());
        r.paramMap = new Map(this.paramMap.entries());
        r.select = Expression.clone(this.select);
        return r;
    }

    addJoin(property: string) {
        const { select } = this;
        select.joins ??= [];

        const relation = this.model.getProperty(property);
        const model = this.context.model.register(relation.relation.relatedTypeClass)[modelSymbol];

        for (const iterator of select.joins) {
            if (model === iterator.model) {
                return iterator[sourceSymbol] as SourceExpression;
            }
        }
        const column = relation.relation.fkColumn;
        const parameter = this.parameter + "." + property;
        const source = this.addSource(model, parameter);
        const join = JoinExpression.create({
            as: QuotedLiteral.create({ literal: source.alias}),
            joinType: column.nullable ? "LEFT" : "INNER",
            model,
            source: QuotedLiteral.create({ literal: model.name }),
            where: BinaryExpression.create({
                left: MemberExpression.create({
                    target: Identifier.create({ value: this.alias }),
                    property: Identifier.create({ value: column.columnName })
                }),
                operator: "=",
                right: MemberExpression.create({
                    target: Identifier.create({ value: source.alias }),
                    property: Identifier.create({ value: model.keys[0].columnName })
                })
            })
        });
        select.joins.push(join);
        join[sourceSymbol] = source;
        return source;
    }

    addSource(model: EntityType, parameter: string) {

        const { context } = this;
        const source = SourceExpression.create({
            model,
            parameter,
            context,
            parent: this
        });

        source.map = this.map;
        source.paramMap = this.paramMap;

        let id = 0;
        let alias: string;
        do {
            alias = model.name[0] + id++;
            const exists = this.map.get(alias);
            if (exists === null || exists === void 0) {
                break;
            }
        }while (true);
        source.alias = alias;
        this.map.set(alias, source);
        this.paramMap.set(parameter, source);
        return source;
    }

    flatten(chain: string[]): ITextQueryFragment {
        const [start, ... others ] = chain;
        if (start === this.parameter) {
            return this.prepareNames(others);
        }
        const mapped = this.paramMap.get(start);
        if (mapped) {
            return mapped.prepareNames(others);
        }
        throw new Error("Not found");
    }

    prepareNames([property , ... others]: string[]): ITextQueryFragment {
        const p = this.model.getProperty(property);
        const quotedLiteral = this.context.driver.compiler.quotedLiteral;
        if (others.length === 0) {
            return `${ QueryParameter.create(this.alias, quotedLiteral)}.${quotedLiteral(p.field.columnName)}`;
        }

        // this must be a navigation...
        const source = this.addJoin(property);
        return source.prepareNames(others);
    }
}
