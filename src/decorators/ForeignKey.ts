import type { IClassOf } from "./IClassOf.js";
import SchemaRegistry from "./SchemaRegistry.js";
import NameParser from "./parser/MemberParser.js";

export default function ForeignKey<T, TRelated>(
        name: (item: T) => any,
        c: IClassOf<TRelated>,
        inv: (item: TRelated) => any
    ) {
    return (target: T, key: string): any => {

        const cn = target.constructor ?? target;
        const type = SchemaRegistry.model(cn);
        
        type.relations.push({
            type,
            name: key,
            foreignKey: NameParser.parseMember(name),
            relatedTypeClass: c,
            relatedName: NameParser.parseMember(inv)
        });
        
    };
}