import type { IClassOf } from "./IClassOf.js";
import { FKType } from "./IColumn.js";
import SchemaRegistry from "./SchemaRegistry.js";
import NameParser from "./parser/NameParser.js";

export default function MultiForeignKeys<T, TRelated>(
    relatedEntityType: IClassOf<TRelated>,
    {
        inverseProperty,
        foreignKeys,
        doNotCreateIndex
    }: {
        inverseProperty: (x: TRelated) => T[],
        foreignKeys: { foreignKey: (x: T) => any, key: (x: TRelated) => any }[],
        doNotCreateIndex?: boolean
    }
) {
    return (target: T, name: string) => {
        const cn = target.constructor ?? target;
        const type = SchemaRegistry.model(cn);

        const fkMap = [] as FKType[];

        const relatedType = SchemaRegistry.model(relatedEntityType);

        for (const { foreignKey, key } of foreignKeys) {
            const fkColumn = type.getColumn(NameParser.parseMember(foreignKey));
            const relatedKeyColumn = relatedType.getColumn(NameParser.parseMember(key));
            fkMap.push({ fkColumn, relatedKeyColumn });
        }

        type.addRelation({
            type,
            name,
            fkMap,
            relatedTypeClass: relatedEntityType,
            relatedName: NameParser.parseMember(inverseProperty),
            doNotCreateIndex
        });
    };
}


// export default function ForeignKey<T, TRelated>(
//     {
//         key: name,
//         related: c,
//         relatedProperty: inv,
//         relatedKey: invKey,
//         dotNotCreateIndex
//     } : {

//             key: (item: T) => any,

//             related: IClassOf<TRelated>,

//             relatedProperty: (item: TRelated) => any,

//             relatedKey?: (item: TRelated) => any,
//             dotNotCreateIndex?: boolean,
//         }

//     ) {
//     return (target: T, key: string): any => {

//         const cn = target.constructor ?? target;
//         const type = SchemaRegistry.model(cn);

//         type.addRelation({
//             type,
//             name: key,
//             foreignKey: NameParser.parseMember(name),
//             relatedTypeClass: c,
//             relatedName: NameParser.parseMember(inv),
//             relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
//             dotNotCreateIndex
//         });

//     };
// }