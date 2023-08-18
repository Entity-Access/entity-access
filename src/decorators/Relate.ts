import type { IClassOf } from "./IClassOf.js";
import SchemaRegistry from "./SchemaRegistry.js";
import NameParser from "./parser/NameParser.js";

export interface IRelatedType<T, TRelated> {
    property: (item: T) => TRelated;
    inverseProperty: (item: TRelated) => T[];
    inverseKey?: (item: TRelated) => any;
    dotNotCreateIndex?: boolean;
}

export interface IRelatedTypeOne<T, TRelated> {
    property: (item: T) => TRelated;
    inverseProperty: (item: TRelated) => T;
    inverseKey?: (item: TRelated) => any;
    dotNotCreateIndex?: boolean;
}

export interface IRelatedTypeWithType<T, TRelated> {
    type: () => IClassOf<TRelated>,
    property: (item: T) => TRelated;
    inverseProperty: (item: TRelated) => T[];
    inverseKey?: (item: TRelated) => any;
    dotNotCreateIndex?: boolean;
}

export interface IRelatedTypeOneWithType<T, TRelated> {
    type: () => IClassOf<TRelated>,
    property: (item: T) => TRelated;
    inverseProperty: (item: TRelated) => T;
    inverseKey?: (item: TRelated) => any;
    dotNotCreateIndex?: boolean;
}
export function RelateTo<T, TRelated>(p: IRelatedTypeWithType<T, TRelated>): (target: T, key: string) => any;
export function RelateTo<T, TRelated>(c: IClassOf<TRelated>, p: IRelatedType<T, TRelated>): (target: T, key: string) => any;
export function RelateTo(c, p?): any {

    if (p === void 0) {
        p = c;
        c = p.type?.();
    }

    const { property, inverseKey: invKey, inverseProperty, dotNotCreateIndex } = p;

    return (target: any, foreignKey: string): any => {

        const cn = target.constructor ?? target;
        const entityType = SchemaRegistry.model(cn);

        const name = NameParser.parseMember(property);

        entityType.addRelation({
            type: entityType,
            name,
            foreignKey,
            relatedTypeClass: c ?? (Reflect as any).getMetadata("design:type", target, name),
            relatedName: NameParser.parseMember(inverseProperty),
            relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
            dotNotCreateIndex
        });

    };
}

export function RelateToOne<T, TRelated>(p: IRelatedTypeOneWithType<T, TRelated>): (target: T, key: string) => any;
export function RelateToOne<T, TRelated>(c: IClassOf<TRelated>, p: IRelatedTypeOne<T, TRelated>): (target: T, key: string) => any;
export function RelateToOne(c, p?): any {

    if (p === void 0) {
        p = c;
        c = p.type?.();
    }

    const { property, inverseKey: invKey, inverseProperty, dotNotCreateIndex } = p;

    return (target: any, foreignKey: string): any => {

        const cn = target.constructor ?? target;
        const entityType = SchemaRegistry.model(cn);

        const name = NameParser.parseMember(property);

        entityType.addRelation({
            type: entityType,
            name,
            foreignKey,
            relatedTypeClass: c ?? (Reflect as any).getMetadata("design:type", target, name),
            relatedName: NameParser.parseMember(inverseProperty),
            relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
            dotNotCreateIndex,
            singleInverseRelation: true
        });

    };
}

// export function RelateToOne<T, TRelated>(c: IClassOf<TRelated>,
//     {
//         property: name, inverseProperty: inv, inverseKey: invKey, dotNotCreateIndex
//     }: {

//         property: (item: T) => TRelated;
//         inverseProperty: (item: TRelated) => T;

//         inverseKey?: (item: TRelated) => any;
//         dotNotCreateIndex?: boolean;
//     }

// ) {
//     return (target: T, key: string): any => {

//         const cn = target.constructor ?? target;
//         const type = SchemaRegistry.model(cn);

//         const r = type.addRelation({
//             type,
//             name: NameParser.parseMember(name),
//             foreignKey: key,
//             relatedTypeClass: c,
//             relatedName: NameParser.parseMember(inv),
//             relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
//             dotNotCreateIndex,
//             singleInverseRelation: true
//         });
//     };
// }
