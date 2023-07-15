import ErrorModel from "./ErrorModel.js";

export default class EntityAccessError extends Error {

    static throw(message: string = "Access denied") {
        throw new EntityAccessError(message);
    }

    public readonly errorModel: ErrorModel;

    constructor(message: string | ErrorModel = "Access denied") {
        super(typeof message === "string"
            ? message
            : message.title);
        this.errorModel = typeof message === "string"
            ? new ErrorModel(message)
            : message;
    }
}