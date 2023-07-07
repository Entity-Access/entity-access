import EntityContext from "../EntityContext.js";
import ChangeEntry from "../changes/ChangeEntry.js";

type KeyValueArray = [string, any][];

export default class VerificationSession {

    constructor(private context: EntityContext) {}

    queueVerification(change: ChangeEntry) {
        const { type, entity } = change;
        if (change.status !== "inserted") {
            // verify access to the entity
            const keys = [] as KeyValueArray;
            for (const iterator of type.keys) {
                const key = entity[iterator.name];
                if (key === void 0) {
                    break;
                }
                keys.push([iterator.name, key]);
            }
            if (keys.length === type.keys.length) {
                this.queueEntityKey(change, keys);
            }
        }

        if (change.status === "deleted") {
            return;
        }

        // for modified or inserted
        // we need to verify access to each foreign key

        for (const relation of type.relations) {
            if (relation.isCollection) {
                continue;
            }

            const fk = relation.fkColumn;
            if (!fk) {
                continue;
            }

            const fkValue = entity[fk.name];
            if (fkValue === void 0) {
                // not set... ignore..
                continue;
            }
        }
    }

    queueEntityKey(change: ChangeEntry, keys: KeyValueArray) {
        throw new Error("Method not implemented.");
    }

    async verifyAsync(): Promise<any> {
        throw new Error("Method not implemented.");
    }
}
