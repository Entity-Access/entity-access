import EntityContext from "../EntityContext.js";
import ChangeEntry from "../changes/ChangeEntry.js";

export default class VerificationSession {

    constructor(private context: EntityContext) {}

    queueVerification(iterator: ChangeEntry) {
        const type = iterator.type;
    }

    async verifyAsync(): Promise<any> {
        throw new Error("Method not implemented.");
    }
}
