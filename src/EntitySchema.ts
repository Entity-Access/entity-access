export class EntityColumn {
    constructor(
        public readonly name: string,
        public readonly columnName: string,
        public readonly storageType: string
    ) {

    }
}

export default class EntitySchema {

    constructor(
        public readonly name: string,
        public readonly table: string,
        public readonly columns: EntityColumn[],
        public readonly schema?: string,
    ) {
    }

}
