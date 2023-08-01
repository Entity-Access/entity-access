import assert from "assert";
import Inject, { RegisterSingleton, ServiceProvider } from "../../di/di.js";
import EternityContext from "../../eternity/EternityContext.js";
import Workflow, { Activity } from "../../eternity/Workflow.js";
import WorkflowClock from "../../eternity/WorkflowClock.js";
import DateTime from "../../types/DateTime.js";
import { TestConfig } from "../TestConfig.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
import EternityStorage from "../../eternity/EternityStorage.js";
import TimeSpan from "../../types/TimeSpan.js";

function sleep(n) {
    return new Promise((resolve) => setTimeout(resolve, n));
}

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

const mockClock = new MockClock();

@RegisterSingleton
class Logger {

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
        @Inject logger?: Logger) {
        await sleep(10);
        logger.items.push({ from, to, message });
    }

}

export default async function (this: TestConfig) {

    const scope = new ServiceProvider();
    scope.add(WorkflowClock, mockClock);
    scope.add(BaseDriver, this.driver);
    const storage = new EternityStorage(this.driver, mockClock);
    await storage.seed();
    scope.add(EternityStorage, storage);

    const c = scope.resolve(EternityContext);

    // this is an important step
    c.register(SendWorkflow);

    const logger = scope.resolve(Logger);

    const id = await c.queue(SendWorkflow, "a");

    mockClock.add(TimeSpan.fromSeconds(1));

    await c.processQueueOnce();

    mockClock.add(TimeSpan.fromSeconds(1));

    await c.processQueueOnce();

    assert.equal(0, logger.items.length);

    mockClock.add(TimeSpan.fromHours(1));

    await c.processQueueOnce();

    assert.notEqual(0, logger.items.length);

    let r = await c.get(SendWorkflow, id);
    assert.equal("1", r.output);

    mockClock.add(TimeSpan.fromDays(2));

    await c.processQueueOnce();

    r = await c.get(SendWorkflow, id);
    assert.strictEqual(null, r);

    // throw new Error("Preserve");

}