export default class EntityAccessError extends Error {

    static throw(message: string = "Access denied") {
        throw new EntityAccessError(message);
    }

    constructor(message: string = "Access denied") {
        super(message);
    }
}