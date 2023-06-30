import EntityType from "../entity-query/EntityType.js";


export default class SchemaRegistry {

    public static model(type) {
        let model = this.map.get(type);
        if (!model) {
            model = new EntityType();
            // @ts-expect-error readonly for compile time only
            model.typeClass = type;
            this.map.set(type, model);
        }
        return model;
    }

    private static map: Map<any, EntityType> = new Map();

}
