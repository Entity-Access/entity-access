import type { IClassOf } from "./IClassOf.js";
import SchemaRegistry from "./SchemaRegistry.js";
import NameParser from "./parser/NameParser.js";



export default function Relate<T, TRelated>(c: IClassOf<TRelated>,
    {
        foreignKey: name, inverseProperty: inv, inverseKey: invKey, dotNotCreateIndex
    }: {

        foreignKey: (item: T) => any;

        inverseProperty: (item: TRelated) => T[];

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

export function RelateOne<T, TRelated>(c: IClassOf<TRelated>,
    {
        foreignKey: name, inverseProperty: inv, inverseKey: invKey, dotNotCreateIndex
    }: {

        foreignKey: (item: T) => any;

        inverseProperty: (item: TRelated) => T;

        inverseKey?: (item: TRelated) => any;
        dotNotCreateIndex?: boolean;
    }

) {
    return (target: T, key: string): any => {

        const cn = target.constructor ?? target;
        const type = SchemaRegistry.model(cn);

        const r = type.addRelation({
            type,
            name: key,
            foreignKey: NameParser.parseMember(name),
            relatedTypeClass: c,
            relatedName: NameParser.parseMember(inv),
            relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
            dotNotCreateIndex
        });
        r.relatedRelation.isCollection = false;
    };
}

export function RelateTo<T, TRelated>(c: IClassOf<TRelated>,
    {
        property,
        inverseProperty, inverseKey: invKey, dotNotCreateIndex
    }: {

        property: (item: T) => TRelated;
        inverseProperty: (item: TRelated) => T[];
        inverseKey?: (item: TRelated) => any;
        dotNotCreateIndex?: boolean;
    }

) {
    return (target: T, foreignKey: string): any => {

        const cn = target.constructor ?? target;
        const type = SchemaRegistry.model(cn);

        type.addRelation({
            type,
            name: NameParser.parseMember(property),
            foreignKey,
            relatedTypeClass: c,
            relatedName: NameParser.parseMember(inverseProperty),
            relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
            dotNotCreateIndex
        });

    };
}


export function RelateToOne<T, TRelated>(c: IClassOf<TRelated>,
    {
        property: name, inverseProperty: inv, inverseKey: invKey, dotNotCreateIndex
    }: {

        property: (item: T) => TRelated;
        inverseProperty: (item: TRelated) => T;

        inverseKey?: (item: TRelated) => any;
        dotNotCreateIndex?: boolean;
    }

) {
    return (target: T, key: string): any => {

        const cn = target.constructor ?? target;
        const type = SchemaRegistry.model(cn);

        const r = type.addRelation({
            type,
            name: NameParser.parseMember(name),
            foreignKey: key,
            relatedTypeClass: c,
            relatedName: NameParser.parseMember(inv),
            relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
            dotNotCreateIndex
        });
        r.relatedRelation.isCollection = false;
    };
}
