import { identitySymbol } from "../../common/symbols/symbols.js";
import SchemaRegistry from "../../decorators/SchemaRegistry.js";
import type EntityType from "../../entity-query/EntityType.js";

export default class IdentityService {

    public static getIdentity(entityType: EntityType, entity) {

        const identity = entity[identitySymbol];
        if (identity) {
            return identity;
        }

        const $type = entityType.entityName;
        const keys = { $type };
        let hasAll = true;
        for (const iterator of entityType.keys) {
            const key = entity[iterator.name];
            if(key === void 0) {
                hasAll = false;
                break;
            }
            keys[iterator.name] = key;
        }

        if (!hasAll) {
            return;
        }
        return entity[identitySymbol] = JSON.stringify(keys);
    }

}