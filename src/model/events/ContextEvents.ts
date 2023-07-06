import { IClassOf } from "../../decorators/IClassOf.js";
import EntityEvents from "./EntityEvents.js";

export default class ContextEvents {

    private map: Map<any, IClassOf<EntityEvents<any>>> = new Map();

    public for<T>(type: IClassOf<T>) {
        const c = this.map.get(type);
        return new c();
    }

}
