interface ICustomEventInit<T> {
    bubbles?: boolean;
    cancelable?: boolean;
    composed?: boolean;
    detail?: T;
}

export default class CustomEvent<T = any> extends Event {

    public readonly detail: T;

    constructor(type: string, init: ICustomEventInit<T>) {
        super(type, init);
        this.detail = init.detail;
    }
}