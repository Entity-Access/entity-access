import { IClassOf } from "../decorators/IClassOf.js";

function clone() {
    Object.getPrototypeOf(this).constructor.create({ ... this });
}

export default class ImmutableObject {

    public static create<T extends ImmutableObject>(this:IClassOf<T>, p: Partial<T>): T {
        (p as any).type = this.name;
        for(const [key, value] of Object.entries(p)) {
            if (!value) {
                continue;
            }
            // if it is array, we should make it immutable
            if (Array.isArray(value)) {
                const array = [];
                let index = 0;
                for (const iterator of value) {
                    Object.defineProperty(array, index++, {
                        value: iterator,
                        writable: false,
                        enumerable: true
                    });
                }
                Object.defineProperty(array, "clone", {
                    value: clone,
                    enumerable: false,
                    writable: false
                });
                Object.defineProperty(p, key, {
                    value: array,
                    enumerable: true,
                    writable: false
                });
                continue;
            }
            Object.defineProperty(p, key, {
                value,
                enumerable: true,
                writable: false
            });
        }
        Object.setPrototypeOf(p, Object.getPrototypeOf(this));
        Object.defineProperty(p, "clone", {
            value: clone,
            enumerable: false,
            writable: false
        });
        return p as T;
    }

}
