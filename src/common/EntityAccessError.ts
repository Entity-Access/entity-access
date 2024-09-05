import ErrorModel from "./ErrorModel.js";

export default class EntityAccessError extends Error {

    static throw(message: string = "Access denied", status = 429) {
        throw new EntityAccessError(message, status);
    }

    public readonly errorModel: ErrorModel;

    constructor(message: string | ErrorModel = "Access denied", status = 500) {
        super(typeof message === "string"
            ? message
            : message.title);
        this.errorModel = typeof message === "string"
            ? new ErrorModel(message, status)
            : message;
    }
}