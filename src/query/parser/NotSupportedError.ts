export class NotSupportedError extends Error {
    constructor(message?: string) {
        super(message ? `${message} Not Supported`: "Not Supported");
    }
}