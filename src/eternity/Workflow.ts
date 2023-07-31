import Inject from "../di/di.js";
import DateTime from "../types/DateTime.js";
import EternityContext from "./EternityContext.js";
import { WorkflowRegistry } from "./WorkflowRegistry.js";


export class ActivitySuspendedError extends Error {}

export function Activity(target, key) {
    WorkflowRegistry.register(target.constructor, key);
}


export default abstract class Workflow<TIn = any, TOut = any> {

    public readonly input: TIn;

    public readonly id: string;

    public readonly eta: DateTime;

    @Inject
    protected readonly context: EternityContext;

    constructor(p: Partial<Workflow>) {
        Object.setPrototypeOf(p, Workflow.prototype);
        return p as Workflow;
    }

    public abstract run(input: TIn): Promise<TOut>;

}