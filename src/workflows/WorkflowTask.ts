/* eslint-disable no-console */
import EALogger from "../common/EALogger.js";
import Sql from "../sql/Sql.js";
import DateTime from "../types/DateTime.js";
import { loadedFromDb, type WorkflowDbContext, type WorkflowItem } from "./WorkflowDbContext.js";

const finalizeTasks = new FinalizationRegistry<{ timer }>(({ timer }: any) => clearInterval(timer));

export default class WorkflowTask implements Disposable {

    timer: NodeJS.Timeout;

    public readonly signal;
    private ac: AbortController;
    private timerKey;

    constructor(
        public readonly item: WorkflowItem,
        public readonly context: WorkflowDbContext,
    ) {
        this.item[loadedFromDb] = true;
        this.timer = setInterval(this.renewLock, 5000);
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
                .catch(EALogger.error);
        }
    }

    renewLock = () => {
        try {
            let { lockedTTL } = this.item;
            if (!lockedTTL) {
                return;
            }
            const now = DateTime.now;
            if (DateTime.from(lockedTTL).msSinceEpoch < now.msSinceEpoch) {
                this.ac.abort(new Error("Timed out"));
                return;
            }
            lockedTTL = this.item.lockedTTL = now.addSeconds(30);
            this.context.workflows.where(this.item, (x, p) => x.id === p.id && x.lockToken === p.lockToken)
                .update((x) => ({ lockedTTL: Sql.date.addSeconds(Sql.date.now(), 30)}))
                .catch(EALogger.error);
        } catch (error) {
            EALogger.error(error);
        }
    };
}