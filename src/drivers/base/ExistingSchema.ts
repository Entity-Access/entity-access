import CIMap from "../../common/CIMap.js";
import IColumnSchema, { IConstraintSchema, IIndexSchema } from "../../common/IColumnSchema.js";
import { BaseConnection } from "./BaseDriver.js";

export default class ExistingSchema {

    static async getSchema(driver: BaseConnection, schema: string) {
        let s = this.cache.get(schema);
        if (!s) {
            s = await driver.getExistingSchema(schema);
            this.cache.set(schema, s);
        }
        return s;
    }

    private static cache = new CIMap<ExistingSchema>();

    public readonly tables: Map<string, Map<string, IColumnSchema>>;
    public readonly indexes: Map<string, IIndexSchema>;
    public readonly constraints: Map<string, IConstraintSchema>;

    constructor(
        private caseInsensitive = false,
        columns: IColumnSchema[],
        indexes: IIndexSchema[],
        constraints: IConstraintSchema[]
    ) {

        this.tables = caseInsensitive
            ? new CIMap<CIMap<IColumnSchema>>()
            : new Map<string,Map<string, IColumnSchema>>();

        for (const c of columns) {
            const table = c.ownerName;
            let list = this.tables.get(table);
            if (!list) {
                list = caseInsensitive ? new CIMap<IColumnSchema>() : new Map<string, IColumnSchema>();
                this.tables.set(table, list);
            }
            list.set(c.name, c);
        }

        this.indexes = caseInsensitive
            ? new CIMap<IIndexSchema>()
            : new Map<string, IIndexSchema>();

        for (const index of indexes) {
            this.indexes.set(index.name, index);
        }

        this.constraints = caseInsensitive
            ? new CIMap<IConstraintSchema>()
            : new Map<string, IConstraintSchema>();

        for (const constraint of constraints) {
            this.constraints.set(constraint.name, constraint);
        }
    }

}