import type EntityContext from "./EntityContext.js";
import { IClassOf } from "../decorators/IClassOf.js";
import SchemaRegistry from "../decorators/SchemaRegistry.js";
import EntityQuery from "./EntityQuery.js";
import { Expression } from "@babel/types";
import { EntitySource } from "./EntitySource.js";



export default class EntityModel {

    public entities: Map<IClassOf<any>, EntitySource> = new Map();

    constructor(private context: EntityContext) {
    }

    register<T>(type: IClassOf<T>) {
        let source = this.entities.get(type);
        if (!source) {
            const model = SchemaRegistry.model(type);
            source = new EntitySource(model, this.context);
            this.entities.set(type, source);
        }
        return source as EntitySource<T>;
    }

}
