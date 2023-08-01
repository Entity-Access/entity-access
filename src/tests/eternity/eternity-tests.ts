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

class SendWorkflow extends Workflow<string> {

    public async run(): Promise<any> {
        await this.sendMail("a", "b", "c");
        return "1";
    }

    @Activity
    public async sendMail(
        from: string,
        to: string,
        message: string,
        @Inject logger: Logger = null) {
        await sleep(10);
        logger.items.push({ from, to, message });
    }

}

export default async function (this: TestConfig) {

    const scope = new ServiceProvider();
    scope.add(BaseDriver, this.driver);
    const c = new EternityContext();
    c.clock = mockClock;
    const storage = new EternityStorage(this.driver, mockClock);
    await storage.seed();
    c.storage = storage;
    scope.add(EternityStorage, storage);
    scope.add(EternityContext, c);

    const logger = scope.resolve(Logger);

    await c.queue(SendWorkflow, "a");

    mockClock.add(TimeSpan.fromSeconds(1));

    await c.processQueueOnce();

    mockClock.add(TimeSpan.fromSeconds(1));

    await c.processQueueOnce();

    assert.notEqual(0, logger.items.length);

}