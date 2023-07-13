import EntityType from "../entity-query/EntityType.js";

const classForNameMap = new Map();

export default class SchemaRegistry {

    static registerClassForName(name: string, target: any) {
        const existing = classForNameMap.get(name);
        if (existing && existing !== target) {
            throw new Error(`${name} is already registered for ${target}`);
        }
        classForNameMap.set(name, target);
    }

    public static model(type) {
        let model = this.map.get(type);
        if (!model) {
            model = new EntityType();
            // @ts-expect-error readonly for compile time only
            model.typeClass = type;
            this.map.set(type, model);
            this.registerClassForName(type.name, model);
        }
        return model;
    }

    public static classForName(name) {
        return classForNameMap.get(name);
    }

    private static map: Map<any, EntityType> = new Map();

}
