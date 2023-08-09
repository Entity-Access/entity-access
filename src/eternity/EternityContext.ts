/* eslint-disable no-console */
import { randomUUID } from "crypto";
import EntityAccessError from "../common/EntityAccessError.js";
import { IClassOf } from "../decorators/IClassOf.js";
import Inject, { RegisterSingleton, ServiceProvider, injectServiceKeysSymbol } from "../di/di.js";
import DateTime from "../types/DateTime.js";
import EternityStorage, { WorkflowStorage } from "./EternityStorage.js";
import type Workflow from "./Workflow.js";
import { ActivitySuspendedError } from "./ActivitySuspendedError.js";
import { IWorkflowSchema, WorkflowRegistry } from "./WorkflowRegistry.js";
import crypto from "crypto";
import TimeSpan from "../types/TimeSpan.js";
import WorkflowClock from "./WorkflowClock.js";
import sleep from "../common/sleep.js";

async function  hash(text) {
    const sha256 = crypto.createHash("sha256");
    return sha256.update(text).digest("hex");
}

function bindStep(context: EternityContext, store: WorkflowStorage, name: string, old: (... a: any[]) => any, unique = false) {
    return async function runStep(this: Workflow, ... a: any[]) {
        const input = JSON.stringify(a);
        const ts = unique ? "0" : Math.floor(this.currentTime.msSinceEpoch);
        const params = input.length < 150 ? input : await hash(input);
        const id = `${this.id}(${params},${ts})`;

        const clock = context.storage.clock;

        const existing = await context.storage.get(id);
        if (existing) {
            if (existing.state === "failed" && existing.error) {
                throw new Error(existing.error);
            }
            if (existing.state === "done") {
                (this as any).currentTime = existing.updated;
                return JSON.parse(existing.output);
            }
        }

        store.lastID = id;

        const step: Partial<WorkflowStorage> = {
            id,
            parentID: this.id,
            eta: this.eta,
            queued: this.eta,
            updated: this.eta,
            isWorkflow: false,
            name,
            input
        };

        // execute...
        const start = clock.utcNow;
        let lastError: Error;
        let lastResult: any;

        if (name === "delay" || name === "waitForExternalEvent") {

            // first parameter is the ts
            const maxTS = a[0] as TimeSpan;
            const eta = this.currentTime.add(maxTS);
            step.eta = eta;

            if (eta <= start) {
                // time is up...
                lastResult = "";
                step.state = "done";
            }

        } else {

            try {

                const types = old[injectServiceKeysSymbol] as any[];
                for (let index = a.length; index < types.length; index++) {
                    const element = ServiceProvider.resolve(this, types[index]);
                    a.push(element);
                }
                lastResult = (await old.apply(this, a)) ?? 0;
                step.output = JSON.stringify(lastResult);
                step.state = "done";
                step.eta = clock.utcNow;
                (this as any).currentTime = step.eta;
            } catch (error) {
                if (error instanceof ActivitySuspendedError) {
                    return;
                }
                lastError = error;
                step.error = error.stack ?? error.toString();
                step.state = "failed";
                step.eta = clock.utcNow;
                (this as any).currentTime = step.eta;
            }
            step.queued = start;
            step.updated = step.updated;
        }
        await context.storage.save(step);
        if (lastError) {
            throw lastError;
        }
        if (step.state !== "done") {
            throw new ActivitySuspendedError();
        }
        return lastResult;
    };
}

export interface IWorkflowResult<T> {
    output: T;
    state: "done" | "failed" | "queued";
    error: string;
}

export default class EternityContext {

    private waiter: AbortController;

    private registry: Map<string, IWorkflowSchema> = new Map();

    constructor(
        @Inject
        public storage: EternityStorage
    ) {

    }

    public register(type: IClassOf<Workflow>) {
        this.registry.set(type.name, WorkflowRegistry.register(type, void 0));
    }

    public async start(signal?: AbortSignal) {
        console.log(`Started executing workflow jobs`);
        while(!signal?.aborted) {
            try {
                const total = await this.processQueueOnce(signal);
                if (total > 0) {
                    // do not wait till we have zero messages to process
                    continue;
                }
            } catch (error) {
                console.error(error);
            }
            const ws = (this.waiter = new AbortController()).signal;
            await sleep(15000, ws);
        }
    }

    public async get<T = any>(c: IClassOf<Workflow<any, T>> | string, id?: string): Promise<IWorkflowResult<T>> {
        id ??= (c as string);
        const s = await this.storage.get(id);
        if (s) {
            return {
                state: s.state,
                output: s.output ? JSON.parse(s.output): null,
                error: s.error
            };
        }
        return null;
    }

    public async queue<T>(
        type: IClassOf<Workflow<T>>,
        input: Partial<T>,
        { id, throwIfExists, eta }: { id?: string, throwIfExists?: boolean, eta?: DateTime } = {}) {
        const clock = this.storage.clock;
        if (id) {
            const r = await this.storage.get(id);
            if (r) {
                if (throwIfExists) {
                    throw new EntityAccessError(`Workflow with ID ${id} already exists`);
                }
                return id;
            }
        } else {
            id = randomUUID();
            while(await this.storage.get(id) !== null) {
                console.log(`Generating UUID again ${id}`);
                id = randomUUID();
            }
        }

        // this will ensure even empty workflow !!
        const schema = WorkflowRegistry.register(type, void 0);

        const now = clock.utcNow;
        eta ??= now;
        await this.storage.save({
            id,
            name: schema.name,
            input: JSON.stringify(input),
            isWorkflow: true,
            queued: now,
            updated: now,
            eta
        });

        if(eta < clock.utcNow) {
            this.waiter?.abort();
        }

        return id;
    }

    public async processQueueOnce(signal?: AbortSignal) {
        const pending = await this.storage.dequeue(signal);
        // run...
        for (const iterator of pending) {
            try {
                await this.run(iterator);
            } catch (error) {
                console.error(error);
            }
        }

        return pending.length;
    }
    private async run(workflow: WorkflowStorage) {

        const clock = this.storage.clock;

        if (workflow.state === "failed" || workflow.state === "done") {
            if (workflow.eta <= clock.utcNow) {
                // time to delete...
                await this.storage.delete(workflow.id);
            }
            return;
        }

        const scope = ServiceProvider.from(this).createScope();

        try {

            const schema = WorkflowRegistry.getByName(workflow.name);
            const { eta, id, updated } = workflow;
            const input = JSON.parse(workflow.input);
            const instance = new (schema.type)({ input, eta, id, currentTime: DateTime.from(updated) });
            for (const iterator of schema.activities) {
                instance[iterator] = bindStep(this, workflow, iterator, instance[iterator]);
            }
            for (const iterator of schema.uniqueActivities) {
                instance[iterator] = bindStep(this, workflow, iterator, instance[iterator], true);
            }
            scope.add( schema.type, instance);
            try {
                const result = await instance.run();
                workflow.output = JSON.stringify(result ?? 0);
                workflow.state = "done";
                workflow.eta = clock.utcNow.add(instance.preserveTime);
            } catch (error) {
                if (error instanceof ActivitySuspendedError) {
                    // this will update last id...
                    await this.storage.save(workflow);
                    return;
                }
                workflow.error = JSON.stringify(error.stack ?? error);
                console.error(error);
                workflow.state = "failed";
                workflow.eta = clock.utcNow.add(instance.failedPreserveTime);
            }

            await this.storage.save(workflow);

        } finally {
            scope.dispose();
        }
    }
}
