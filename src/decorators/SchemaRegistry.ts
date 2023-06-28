import EntityType from "../entity-query/EntityType.js";


export default class SchemaRegistry {

    private static map: Map<any, EntityType> = new Map();

    public static model(type) {
        let model = this.map.get(type);
        if (!model) {
            model = new EntityType();
            // @ts-expect-error
            model.typeClass = type;
            this.map.set(type, model);
        }
        return model;
    }

}
