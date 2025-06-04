/* eslint-disable no-console */
import DateTime from "../types/DateTime.js";
import { loadedFromDb, type WorkflowDbContext, type WorkflowItem } from "./WorkflowDbContext.js";

const finalizeTasks = new FinalizationRegistry<{ timer }>(({ timer }: any) => clearInterval(timer));

export default class WorkflowTask implements Disposable {

    timer: NodeJS.Timer;

    public readonly signal;
    private ac: AbortController;
    private timerKey;

    constructor(
        public readonly item: WorkflowItem,
        public readonly context: WorkflowDbContext,
    ) {
        this.item[loadedFromDb] = true;
        this.timer = setInterval(this.renewLock, 3000);
        this.timerKey = { timer: this.timer };
        this.ac = new AbortController();
        this.signal = this.ac.signal;
        finalizeTasks.register(this, this.timerKey);
    }

    [Symbol.dispose]() {
        clearInterval(this.timer);
        finalizeTasks.unregister(this.timerKey);
        const { id, lockToken } = this.item;
        if (lockToken) {
            this.context.workflows.statements.update({ lockedTTL: null, lockToken: null}, { id, lockToken})
                .catch(console.error);
        }
    }

    renewLock = () => {
        try {
            const { id, lockToken } = this.item;
            let { lockedTTL } = this.item;
            if (!lockedTTL) {
                return;
            }
            const now = DateTime.now;
            if (DateTime.from(lockedTTL).msSinceEpoch < now.msSinceEpoch) {
                this.ac.abort(new Error("Timed out"));
                return;
            }
            lockedTTL = this.item.lockedTTL = now.addSeconds(15);
            this.context.workflows.statements.update({ lockedTTL }, {id, lockToken})
                .catch(console.error);
        } catch (error) {
            console.error(error);
        }
    };
}