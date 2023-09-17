import { IClassOf } from "../decorators/IClassOf.js";
import Inject from "../di/di.js";
import DateTime from "../types/DateTime.js";
import TimeSpan from "../types/TimeSpan.js";
import { ActivitySuspendedError } from "./ActivitySuspendedError.js";
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

    constructor(
        {
            sequence,
            input,
            id,
            eta,
            currentTime
        }: {
            sequence: string,
            input: TIn,
            id: string,
            eta: DateTime,
            currentTime: DateTime
        },
        protected context: EternityContext
    ) {
        this.input = input;
        this.id = id;
        this.eta = eta;
        this.currentTime = currentTime;
        this.sequence = sequence;
    }

    public abstract run(): Promise<TOut>;

    protected delay(ts: TimeSpan) {
        return Promise.resolve("");
    }

    protected waitForExternalEvent<T = any, TA extends string[] = string[]>(ts: TimeSpan, ... names: TA) {
        // do nothing...
        return Promise.resolve<{
            name: TA[number] | null | undefined,
            result: T
        }>({} as any);
    }

    protected async runChild<TChildIn, TChildOut>(type: IClassOf<Workflow<TChildIn, TChildOut>>, input: TChildIn): Promise<TChildOut> {
        return this.context.runChild(this, type, input);
    }

    protected async all<T extends readonly unknown[] | []>(values: T): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>{
        let suspended: ActivitySuspendedError;
        try {
            const r = await Promise.all(values.map(async (x) => {
                try {
                    return await x;
                } catch (error) {
                    if (error instanceof ActivitySuspendedError) {
                        suspended = error;
                    }
                    throw error;
                }
            }));
            return r as any;
        } catch (error) {
            if (suspended) {
                throw suspended;
            }
            throw error;
        }
    }
}