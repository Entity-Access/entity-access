import type { IClassOf } from "./IClassOf.js";
import SchemaRegistry from "./SchemaRegistry.js";
import NameParser from "./parser/MemberParser.js";


export default function ForeignKey<T, TRelated>(
    {
        key: name,
        related: c,
        relatedProperty: inv,
        relatedKey: invKey,
        dotNotCreateIndex
    } : {

            key: (item: T) => any,

            related: IClassOf<TRelated>,

            relatedProperty: (item: TRelated) => any,

            relatedKey?: (item: TRelated) => any,
            dotNotCreateIndex?: boolean,
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