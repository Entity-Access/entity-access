import assert from "assert";
import Inject, { Register, RegisterSingleton, ServiceProvider } from "../../di/di.js";
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

    private time: DateTime = DateTime.now;

    public add(ts: TimeSpan) {
        this.time = this.time.add(ts);
        return this;
    }
}

@RegisterSingleton
class Mailer {

    public items: any[] = [];
}

class SendWorkflow extends Workflow<string, string> {

    public async run(): Promise<any> {

        await this.delay(TimeSpan.fromHours(1));

        await this.sendMail("a", "b", "c");
        return "1";
    }

    @Activity
    public async sendMail(
        from: string,
        to: string,
        message: string,
        @Inject logger?: Mailer) {
        await sleep(10);
        logger.items.push({ from, to, message });
    }

}

export default async function (this: TestConfig) {

    const mockClock = new MockClock();
    const mailer = new Mailer();

    const scope = new ServiceProvider();
    scope.add(WorkflowClock, mockClock);
    scope.add(BaseDriver, this.driver);
    const storage = new WorkflowStorage(this.driver, mockClock);
    scope.add(Mailer, mailer);
    scope.add(WorkflowStorage, storage);

    const c = new WorkflowContext(storage);
    scope.add(WorkflowContext, c);

    // this is an important step
    c.register(SendWorkflow);

    await storage.seed();

    const id = await c.queue(SendWorkflow, "a");

    mockClock.add(TimeSpan.fromSeconds(15));

    await c.processQueueOnce();

    mockClock.add(TimeSpan.fromSeconds(15));

    await c.processQueueOnce();

    assert.equal(0, mailer.items.length);

    mockClock.add(TimeSpan.fromHours(1));

    await c.processQueueOnce();

    assert.equal(1, mailer.items.length);

    let r = await c.get(SendWorkflow, id);
    assert.equal("1", r.output);

    mockClock.add(TimeSpan.fromDays(2));

    await c.processQueueOnce();

    r = await c.get(SendWorkflow, id);
    assert.strictEqual(null, r);

    // throw new Error("Preserve");
}