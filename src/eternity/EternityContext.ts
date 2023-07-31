import EntityAccessError from "../common/EntityAccessError.js";
import Inject, { RegisterSingleton } from "../di/di.js";
import DateTime from "../types/DateTime.js";
import EternityStorage from "./EternityStorage.js";
import Workflow from "./Workflow.js";


@RegisterSingleton
export default class EternityContext {

    private waiter: AbortController;

    @Inject
    private storage: EternityStorage;

    public async start(signal?: AbortSignal) {
        while(!signal.aborted) {
            await this.process(signal);
        }
    }

    public async queue(workflow: Workflow, throwIfExists?: boolean) {
        const id = workflow.id;
        if (id) {
            const r = await this.storage.get(id);
            if (r) {
                if (throwIfExists) {
                    throw new EntityAccessError(`Workflow with ID ${id} already exists`);
                }
                return;
            }
        }

        await this.storage.save({
            id,
            input: JSON.stringify(workflow.input),
            isWorkflow: true,
            queued: DateTime.utcNow,
            eta: workflow.eta
        });

        if(workflow.eta < DateTime.utcNow) {
            this.waiter.abort();
        }
    }

    async process(signal?: AbortSignal) {
        const pending = await this.storage.dequeue(signal);
    }
}
