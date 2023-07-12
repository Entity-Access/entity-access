import type { IClassOf } from "./IClassOf.js";
import SchemaRegistry from "./SchemaRegistry.js";
import NameParser from "./parser/NameParser.js";



export default function Relate<T, TRelated>(c: IClassOf<TRelated>,
    {
        foreignKey: name, inverseProperty: inv, inverseKey: invKey, dotNotCreateIndex
    }: {

        foreignKey: (item: T) => any;

        inverseProperty: (item: TRelated) => any;

        inverseKey?: (item: TRelated) => any;
        dotNotCreateIndex?: boolean;
    }

) {
    return (target: T, key: string): any => {

        const cn = target.constructor ?? target;
        const type = SchemaRegistry.model(cn);

        type.addRelation({
            type,
            name: key,
            foreignKey: NameParser.parseMember(name),
            relatedTypeClass: c,
            relatedName: NameParser.parseMember(inv),
            relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
            dotNotCreateIndex
        });

    };
}
