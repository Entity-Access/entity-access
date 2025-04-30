/* eslint-disable no-console */
import DateTime from "../types/DateTime.js";
import type { WorkflowDbContext, WorkflowItem } from "./WorkflowDbContext.js";

export default class WorkflowTask implements Disposable {

    timer: NodeJS.Timer;

    public readonly signal;
    private ac: AbortController;

    constructor(
        public readonly item: WorkflowItem,
        public readonly context: WorkflowDbContext,
    ) {
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
        if (DateTime.from(lockedTTL).msSinceEpoch < now.msSinceEpoch) {
            this.ac.abort(new Error("Timed out"));
            return;
        }

        this.context.workflows.statements.update({ lockedTTL: now.addSeconds(15) }, {id, lockToken})
            .catch(console.error);
    };
}