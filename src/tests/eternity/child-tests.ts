import assert from "assert";
import Inject, { Register, RegisterSingleton, ServiceProvider } from "../../di/di.js";
import WorkflowContext from "../../workflows/WorkflowContext.js";
import Workflow, { Activity, UniqueActivity } from "../../workflows/Workflow.js";
import WorkflowClock from "../../workflows/WorkflowClock.js";
import DateTime from "../../types/DateTime.js";
import { TestConfig } from "../TestConfig.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
import WorkflowStorage from "../../workflows/WorkflowStorage.js";
import TimeSpan from "../../types/TimeSpan.js";
import sleep from "../../common/sleep.js";

class MockClock extends WorkflowClock {

    public get utcNow(): DateTime {
        return this.time;
    }

    public set utcNow(v: DateTime) {
        this.time = v;
    }

    private time: DateTime = DateTime.utcNow;

    public add(ts: TimeSpan) {
        this.time = this.time.add(ts);
        return this;
    }
}

@RegisterSingleton
class CallTracker {
    track: number = 0;
}

class ChildWorkflow extends Workflow<[string, string], string> {

    async run() {
        await this.delay(TimeSpan.fromSeconds(30));
        return await this.add("Name:", this.input);
    }

    @UniqueActivity
    async add(a: string, b: string[], @Inject tracker?: CallTracker) {
        tracker.track++;
        return a + " " + b.join(" ");
    }
}

class ParentWorkflow extends Workflow<string, string> {

    public async run(): Promise<any> {
        const all = await this.all([
            this.runChild(ChildWorkflow, [this.input, "1"]),
            this.runChild(ChildWorkflow, [this.input, "2"])
        ]);

        return all.join(",");
    }

}

export default async function(this: TestConfig) {

    const mockClock = new MockClock();

    const tracker = new CallTracker();

    const scope = new ServiceProvider();
    scope.add(WorkflowClock, mockClock);
    scope.add(BaseDriver, this.driver);
    scope.add(CallTracker, tracker);
    const storage = new WorkflowStorage(this.driver, mockClock);
    scope.add(WorkflowStorage, storage);

    const c = new WorkflowContext(storage);
    scope.add(WorkflowContext, c);

    // this is an important step
    c.register(ChildWorkflow);
    c.register(ParentWorkflow);

    await storage.seed();

    const id = await c.queue(ParentWorkflow, "a");

    mockClock.add(TimeSpan.fromSeconds(15));

    await c.processQueueOnce();

    assert.equal(0, tracker.track);

    mockClock.add(TimeSpan.fromSeconds(20));

    await c.processQueueOnce();

    mockClock.add(TimeSpan.fromSeconds(20));

    await c.processQueueOnce();

    mockClock.add(TimeSpan.fromSeconds(20));

    await c.processQueueOnce();

    assert.notEqual(0, tracker.track);

    await c.processQueueOnce();

    mockClock.add(TimeSpan.fromSeconds(5));

    await c.processQueueOnce();
    mockClock.add(TimeSpan.fromSeconds(5));
    await c.processQueueOnce();
    mockClock.add(TimeSpan.fromSeconds(5));
    await c.processQueueOnce();

    const r = await storage.getWorkflow(id);
    assert.equal("done", r.state);
}