import Inject from "../di/di.js";
import DateTime from "../types/DateTime.js";
import TimeSpan from "../types/TimeSpan.js";
import EternityContext from "./EternityContext.js";
import { WorkflowRegistry } from "./WorkflowRegistry.js";


export function Activity(target, key) {
    WorkflowRegistry.register(target.constructor, key);
}

export function UniqueActivity(target, key) {
    WorkflowRegistry.register(target.constructor, key, true);
}


export default abstract class Workflow<TIn = any, TOut = any> {

    /**
     * If specified, all workflows in same sequence
     * will executed sequentially in a single worker node
     */
    public readonly sequence: string;

    public readonly input: TIn;

    public readonly id: string;

    public readonly eta: DateTime;

    public readonly currentTime: DateTime;

    public preserveTime: TimeSpan = TimeSpan.fromMinutes(5);

    public failedPreserveTime: TimeSpan = TimeSpan.fromDays(1);

    @Inject
    protected readonly context: EternityContext;

    constructor(p: Partial<Workflow>) {
        Object.setPrototypeOf(p, new.target.prototype);
        return p as Workflow;
    }

    public abstract run(): Promise<TOut>;

    public delay(ts: TimeSpan) {
        return Promise.resolve("");
    }

    public waitForExternalEvent(ts: TimeSpan, ... names: string[]) {
        // do nothing...
        return Promise.resolve("");
    }
}