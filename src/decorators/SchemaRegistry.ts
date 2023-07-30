import EntityType from "../entity-query/EntityType.js";

const classForNameMap = new Map();

const entityNameSymbol = Symbol("entityName");

export default class SchemaRegistry {

    static entityNameForClass(c) {
        return c[entityNameSymbol] ??= this.model(c).entityName;
    }

    static registerClassForName(name: string, target: any) {
        const existing = classForNameMap.get(name);
        if (existing) {
            if (existing !== target) {
                throw new Error(`${name} is already registered for ${target}`);
            }
            return;
        }
        classForNameMap.set(name, target);
        const m = this.model(target);
        // @ts-expect-error readonly
        m.entityName = name;
    }

    public static model(type) {
        let model = this.map.get(type);
        if (!model) {
            model = new EntityType();
            // @ts-expect-error readonly for compile time only
            model.typeClass = type;
            this.map.set(type, model);
            // @ts-expect-error readonly
            model.entityName ??= type.name;
            this.registerClassForName(model.entityName, type);
        }
        return model;
    }

    public static classForName(name) {
        return classForNameMap.get(name);
    }

    private static map: Map<any, EntityType> = new Map();

}
