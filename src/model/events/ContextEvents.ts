import EntityAccessError from "../../common/EntityAccessError.js";
import { IClassOf } from "../../decorators/IClassOf.js";
import { ServiceProvider } from "../../di/di.js";
import { NotSupportedError } from "../../query/parser/NotSupportedError.js";
import type EntityContext from "../EntityContext.js";
import type EntityEvents from "./EntityEvents.js";

export default class ContextEvents {

    private map: Map<any, IClassOf<EntityEvents<any>>> = new Map();

    public for<T>(type: IClassOf<T>, fail = true): IClassOf<EntityEvents<T>> {
        const typeClass = this.map.get(type);
        if (!typeClass) {
            if (fail) {
                throw new EntityAccessError(`No security rules declared for ${type.name}`);
            }
            return null;
        }
        return typeClass;
    }

    public register<T>(type: IClassOf<T>, events: IClassOf<EntityEvents<T>>) {
        this.map.set(type, events);
    }

    public registerAll<T>(types: (IClassOf<EntityEvents<T>> & { typeClass: IClassOf<T>})[]) {
        for (const iterator of types) {
            this.map.set(iterator.typeClass, iterator);
        }
    }

}
