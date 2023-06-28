
export interface IDbColumn {
    name: string;
    columnName?: string;
    isKey?: boolean;
}

/**
 * DbQuery represents sql equivalent table with columns...
 */
export default class EntityType {

    public readonly name: string;
    public readonly schema: string;

    public readonly columns: IDbColumn[];

    public get keys() {
        return this.columns.filter((x) => x.isKey);
    }

    public get nonKeys() {
        return this.columns.filter((x) => !x.isKey);
    }

    constructor(
        p: Partial<EntityType>
    ) {
        Object.setPrototypeOf(p, EntityType.prototype);
        return p as any;
    }

}