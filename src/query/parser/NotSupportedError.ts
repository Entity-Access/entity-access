import EntityAccessError from "../../common/EntityAccessError.js";

export class NotSupportedError extends EntityAccessError {
    constructor(message?: string) {
        super(message ? `${message} Not Supported`: "Not Supported");
    }
}