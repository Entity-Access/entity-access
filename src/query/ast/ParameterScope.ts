import type EntityType from "../../entity-query/EntityType.js";
import type { ParameterExpression, SelectStatement } from "./Expressions.js";


export interface IMappingModel {
    parameter: ParameterExpression;
    selectStatement?: SelectStatement;
    name?: string;
    model?: EntityType;
    replace?: ParameterExpression;
}

/**
 * This class will provide scope for ever parameter along with type mapping, unique name and
 * and replace parameter
 */
export default class ParameterScope {

    private map:Map<ParameterExpression, IMappingModel> = new Map();

    private names: Set<string> = new Set();

    public get(p: ParameterExpression) {
        const model = this.map.get(p);
        return model;
    }

    public nameOf(p: ParameterExpression) {
        const model = this.map.get(p);
        return model.name;
    }

    public alias(
        originalParameter: ParameterExpression,
        alias: ParameterExpression,
        selectStatement: SelectStatement
    ) {
        const model = this.map.get(originalParameter);
        return this.create({ parameter: alias, selectStatement, name: model.name, replace: originalParameter });
    }

    create(model: IMappingModel) {

        const existing = this.map.get(model.parameter);
        if (existing) {
            existing.replace = model.replace;
            existing.selectStatement = model.selectStatement;
            existing.model ??= existing.selectStatement.model;
            return;
        }

        if (!model.replace) {
            // create name...
            model.name = this.createName(model.parameter.model?.name?.[0] ?? model.parameter.name, model.parameter.name );
        }

        if (!model.model) {
            if (model.parameter.model) {
                model.model = model.parameter.model;
            } else if (model.selectStatement){
                model.model = model.selectStatement.model;
            }
        }

        this.map.set(model.parameter, model);
    }
    createName(prefix: string, name): string {
        if (!this.names.has(name)) {
            this.names.add(name);
            return name;
        }
        let index = 1;
        while(true) {
            name = `${prefix}${index++}`;
            if (this.names.has(name)) {
                continue;
            }
            this.names.add(name);
            return name;
        }
    }

    delete(param1: ParameterExpression) {
        // this.map.delete(param1);
    }

}
