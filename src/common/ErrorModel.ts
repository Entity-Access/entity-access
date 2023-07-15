export interface IFieldError {
    name: string;
    reason: string;
}

export default class ErrorModel {

    public paramErrors: IFieldError[] = [];

    public get detail() {
        return this.paramErrors.map((x) => x.name ? `${x.name}: ${x.reason}` : x.reason).join("\r\n");
    }

    constructor(public title: string) {
    }

    public addError(name: string, reason: string) {
        this.paramErrors.push({ name, reason });
    }

    public toString() {
        return `${this.title}\r\n${this.detail}`;
    }
}