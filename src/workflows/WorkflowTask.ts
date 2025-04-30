/* eslint-disable no-console */
import DateTime from "../types/DateTime.js";
import { loadedFromDb, type WorkflowDbContext, type WorkflowItem } from "./WorkflowDbContext.js";

export default class WorkflowTask implements Disposable {

    timer: NodeJS.Timer;

    total = 1;

    public readonly signal;
    private ac: AbortController;

    constructor(
        public readonly item: WorkflowItem,
        public readonly context: WorkflowDbContext,
    ) {
        this.item[loadedFromDb] = true;
        this.timer = setInterval(this.renewLock, 3000);
        this.ac = new AbortController();
        this.signal = this.ac.signal;
    }

    [Symbol.dispose]() {
        clearInterval(this.timer);
        const { id, lockToken } = this.item;
        if (lockToken) {
            this.context.workflows.statements.update({ lockedTTL: null, lockToken: null}, { id, lockToken})
                .catch(console.error);
        }
    }

    renewLock = () => {
        const { id, lockToken, lockedTTL } = this.item;
        const now = DateTime.now;
        if (this.total) {
            this.total += 1;
            if (this.total > 10) {
                console.log(`${this.item.id} is running for more than 30 seconds.`);
                this.total = 0;
            }
        }
        if (DateTime.from(lockedTTL).msSinceEpoch < now.msSinceEpoch) {
            this.ac.abort(new Error("Timed out"));
            return;
        }

        this.context.workflows.statements.update({ lockedTTL: now.addSeconds(15) }, {id, lockToken})
            .catch(console.error);
    };
}