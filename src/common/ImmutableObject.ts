export default class ImmutableObject {

    public static create<T extends ImmutableObject>(p: Partial<T>): T {
        for(const [key, value] of Object.entries(p)) {
            if (!value) {
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
            value: ImmutableObject.prototype.clone,
            enumerable: false,
            writable: false
        });
        return p as T;
    }

    public clone() {
        Object.getPrototypeOf(this).constructor.create({ ... this });
    }

}
