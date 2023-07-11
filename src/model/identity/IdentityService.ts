import SchemaRegistry from "../../decorators/SchemaRegistry.js";
import type EntityType from "../../entity-query/EntityType.js";

export const identityMapSymbol = Symbol("identityMapSymbol");

export default class IdentityService {

    public static buildIdentity(model: EntityType, ... keys: any[]) {
        const type = model.name;
        return JSON.stringify({ type, keys });
    }

    public static getIdentity(entity) {
        const entityType = SchemaRegistry.model(Object.getPrototypeOf(entity).constructor);
        const keys = [];
        for (const iterator of entityType.keys) {
            const key = entity[iterator.name];
            if(key === void 0) {
                break;
            }
            keys.push(key);
        }

        if (keys.length !== entityType.keys.length) {
            return;
        }
        const type = entityType.name;
        return JSON.stringify({ type , keys });
    }

}