import type { IClassOf } from "./IClassOf.js";
import { IForeignKeyConstraint } from "./IForeignKeyConstraint.js";
import SchemaRegistry from "./SchemaRegistry.js";
import NameParser from "./parser/NameParser.js";


export interface IRelatedType<T, TRelated> {
    property: (item: T) => TRelated;
    inverseProperty: (item: TRelated) => T[];
    inverseKey?: (item: TRelated) => any;
    dotNotCreateIndex?: boolean;
    foreignKeyConstraint?: IForeignKeyConstraint;
}

export interface IRelatedTypeOne<T, TRelated> {
    property: (item: T) => TRelated;
    inverseProperty: (item: TRelated) => T;
    inverseKey?: (item: TRelated) => any;
    dotNotCreateIndex?: boolean;
    foreignKeyConstraint?: IForeignKeyConstraint;
}

export interface IRelatedTypeWithType<T, TRelated> {
    type: () => IClassOf<TRelated>,
    property: (item: T) => TRelated;
    inverseProperty: (item: TRelated) => T[];
    inverseKey?: (item: TRelated) => any;
    dotNotCreateIndex?: boolean;
    foreignKeyConstraint?: IForeignKeyConstraint;
}

export interface IRelatedTypeOneWithType<T, TRelated> {
    type: () => IClassOf<TRelated>,
    property: (item: T) => TRelated;
    inverseProperty: (item: TRelated) => T;
    inverseKey?: (item: TRelated) => any;
    dotNotCreateIndex?: boolean;
    foreignKeyConstraint?: IForeignKeyConstraint;
}
export function RelateTo<T, TRelated>(p: IRelatedTypeWithType<T, TRelated>): (target: T, key: string) => any;
export function RelateTo<T, TRelated>(c: IClassOf<TRelated>, p: IRelatedType<T, TRelated>): (target: T, key: string) => any;
export function RelateTo(c, p?): any {

    if (p === void 0) {
        p = c;
        // c = p.type?.();
        if (p.type) {
            c = void 0;
        }
    }

    const { property, inverseKey: invKey, inverseProperty, dotNotCreateIndex, foreignKeyConstraint } = p;

    return (target: any, fkName: string): any => {

        const cn = target.constructor ?? target;
        const entityType = SchemaRegistry.model(cn);

        const name = NameParser.parseMember(property);

        entityType.addRelation({
            type: entityType,
            name,
            fkName,
            fkMap: null,
            relatedTypeClass: c,
            relatedTypeClassFactory: p.type,
            relatedName: NameParser.parseMember(inverseProperty),
            relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
            foreignKeyConstraint,
            doNotCreateIndex: dotNotCreateIndex
        });

    };
}

export function RelateToOne<T, TRelated>(p: IRelatedTypeOneWithType<T, TRelated>): (target: T, key: string) => any;
export function RelateToOne<T, TRelated>(c: IClassOf<TRelated>, p: IRelatedTypeOne<T, TRelated>): (target: T, key: string) => any;
export function RelateToOne(c, p?): any {

    if (p === void 0) {
        p = c;
        // c = p.type?.();
        if (p.type) {
            c = void 0;
        }
    }

    const { property, inverseKey: invKey, inverseProperty, dotNotCreateIndex } = p;

    return (target: any, fkName: string): any => {

        const cn = target.constructor ?? target;
        const entityType = SchemaRegistry.model(cn);

        const name = NameParser.parseMember(property);

        entityType.addRelation({
            type: entityType,
            name,
            fkName,
            fkMap:null,
            relatedTypeClass: c,
            relatedTypeClassFactory: p.type,
            relatedName: NameParser.parseMember(inverseProperty),
            relatedKey: invKey ? NameParser.parseMember(invKey) : void 0,
            doNotCreateIndex: dotNotCreateIndex,
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
