import { modelSymbol } from "../common/symbols/symbols.js";
import EntityType from "../entity-query/EntityType.js";
import { BinaryExpression, ExpressionAs, Identifier, JoinExpression, MemberExpression, QuotedLiteral, SelectStatement } from "../query/ast/Expressions.js";
import { ITextOrFunction } from "../query/ast/IStringTransformer.js";
import EntityContext from "./EntityContext.js";

const sourceSymbol = Symbol("source");

export class SourceExpression {

    public static create(p: Partial<SourceExpression>) {
        return new SourceExpression(p);
    }

    alias: string;
    parameter?: string;
    context: EntityContext;
    model?: EntityType;
    include?: EntityType[];
    select: SelectStatement;

    private map: Map<string,SourceExpression>;
    private paramMap: Map<string, SourceExpression>;

    constructor(p: Partial<SourceExpression>) {
        Object.setPrototypeOf(p, SourceExpression.prototype);
        return p as SourceExpression;
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
        const column = relation.field;
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

    addSource(type, parameter) {

        const model = this.context.model.register(type)[modelSymbol];

        this.map ??= new Map();
        const { context } = this;
        const source = SourceExpression.create({
            model,
            parameter,
            context
        });
        let id = 0;
        let alias: string;
        do {
            alias = model.name[0] + id++;
            const exists = this.map.get(source.alias);
            if (exists === null || exists === void 0) {
                break;
            }
        }while (true);
        source.alias = alias;
        this.map ??= new Map();
        this.map.set(alias, source);
        this.paramMap ??= new Map();
        this.paramMap.set(parameter, source);
        return source;
    }

    flatten(chain: string[]): ITextOrFunction {
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

    prepareNames([property , ... others]: string[]): ITextOrFunction {
        const p = this.model.getProperty(property);
        const quotedLiteral = this.context.driver.compiler.quotedLiteral;
        if (others.length === 0) {
            return `${quotedLiteral(this.alias)}.${quotedLiteral(p.field.columnName)}`;
        }

        // this must be a navigation...
        const source = this.addJoin(property);
        return source.flatten(others);
    }
}
