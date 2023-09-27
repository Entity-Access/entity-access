import assert from "assert";
import Inject, { Register, RegisterScoped, RegisterSingleton, ServiceProvider } from "../../di/di.js";
import WorkflowContext from "../../workflows/WorkflowContext.js";
import Workflow, { Activity } from "../../workflows/Workflow.js";
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
class StateLogger {
    state: string;
}

class VerifyWorkflow extends Workflow<string, string> {

    public async run() {

        const ts = TimeSpan.fromSeconds(15);

        for (let index = 0; index < 5; index++) {
            const { name, result } = await this.waitForExternalEvent(ts, "verify", "resend");
            switch(name) {
                case "verify":
                    await this.log("verify");
                    if (result === this.input) {
                        return "ok";
                    }
                    break;
                case "resend":
                    // do something...
                    await this.delay(TimeSpan.fromSeconds(1));
                    await this.log("resend");
                    break;
            }
        }

        return "failed";
    }

    @Activity
    async log(
        state: string,
        @Inject stateLogger?: StateLogger
    ) {
        console.log(`${state} logged`);
        stateLogger.state = state;
    }

}

export default async function (this: TestConfig) {

    const mockClock = new MockClock();
    const stateLogger = new StateLogger();
    const scope = new ServiceProvider();
    scope.add(WorkflowClock, mockClock);
    scope.add(BaseDriver, this.driver);
    scope.add(StateLogger, stateLogger);
    const storage = new WorkflowStorage(this.driver, mockClock);
    scope.add(WorkflowStorage, storage);

    const c = new WorkflowContext(storage);
    scope.add(WorkflowContext, c);

    // this is an important step
    c.register(VerifyWorkflow);

    await storage.seed();

    const id = await c.queue(VerifyWorkflow, "a");

    mockClock.add(TimeSpan.fromSeconds(5));

    await c.processQueueOnce();

    let w = await c.get(VerifyWorkflow, id);
    assert.equal("queued", w.state);

    mockClock.add(TimeSpan.fromSeconds(5));
    await c.processQueueOnce();

    w = await c.get(VerifyWorkflow, id);
    assert.equal("queued", w.state);

    await c.raiseEvent(id, { name: "resend"});
    mockClock.add(TimeSpan.fromSeconds(5));
    await c.processQueueOnce();

    assert.equal("resend", stateLogger.state);

    w = await c.get(VerifyWorkflow, id);
    assert.equal("queued", w.state);

    mockClock.add(TimeSpan.fromSeconds(5));
    await c.raiseEvent(id, { name: "verify", result: "a"});
    mockClock.add(TimeSpan.fromSeconds(5));
    await c.processQueueOnce();
    assert.equal("verify", stateLogger.state);

    w = await c.get(VerifyWorkflow, id);
    assert.equal("done", w.state);

    mockClock.add(TimeSpan.fromDays(1));
    await c.processQueueOnce();

    // make sure workflow is deleted...

    w = await c.get(VerifyWorkflow, id);
    assert.equal(null, w);
}