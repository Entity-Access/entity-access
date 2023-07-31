import assert from "assert";
import Inject, { RegisterSingleton, ServiceProvider } from "../../di/di.js";
import EternityContext from "../../eternity/EternityContext.js";
import Workflow, { Activity } from "../../eternity/Workflow.js";
import WorkflowClock from "../../eternity/WorkflowClock.js";
import DateTime from "../../types/DateTime.js";
import { TestConfig } from "../TestConfig.js";
import { BaseDriver } from "../../drivers/base/BaseDriver.js";
import EternityStorage from "../../eternity/EternityStorage.js";

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

    const scope = ServiceProvider.global.createScope();

    const c = new EternityContext();
    c.clock = mockClock;
    const storage = new EternityStorage(this.driver);
    c.storage = storage;
    scope.add(EternityContext, c);

    const logger = ServiceProvider.global.resolve(Logger);

    await c.queue(SendWorkflow, "a");

    const r = c.start();

    await sleep(1000);

    assert.notEqual(0, logger.items.length);

}