import Queue from "./Queue.js";
import sleep from "./sleep.js";

export default class TaskManager {

    public rateLimit = 10;

    private running: Set<any> = new Set();

    private waiting: Queue<{ resolve, reject, fx }> = new Queue();

    public error: (error: any) => void;

    public queue<TR>(fxs: ((...a: any[]) => Promise<TR>)[]): Promise<void> {
        for(const fx of fxs) {
            this.queueRun(fx).catch((e) => this.error?.(e));
        }
        return new Promise((resolve) => {
            (async () => {
                for(;;) {
                    await sleep(100);
                    if (this.running.size > 0) {
                        continue;
                    }
                    await sleep(10);
                    if (this.running.size > 0) {
                        continue;
                    }
                    break;
                }
                resolve();
            })().catch((e) => this.error?.(e));
        });
    }

    protected queueRun<TR>(fx: (... a: any[]) => Promise<TR>): Promise<TR> {

        const pr = new Promise((resolve, reject) => {
            this.waiting.enqueue({ resolve, reject, fx });
        });

        // this is to prevent uncaught promise error.
        // eslint-disable-next-line no-console
        pr.catch((error) => this.error?.(error));

        this.processQueue();

        return pr as Promise<TR>;
    }

    protected processQueue() {
        for(;;) {
            if (this.running.size >= this.rateLimit) {
                return;
            }

            const t = this.waiting.dequeue();
            if (!t) {
                return;
            }

            const { fx, resolve, reject } = t;

            this.running.add(fx);

            fx().then(
                (r) => {
                    this.running.delete(fx);
                    setTimeout(() => this.processQueue(), 1);
                    resolve(r);
                },
                (e) => {
                    this.running.delete(fx);
                    setTimeout(() => this.processQueue(), 1);
                    reject(e);
                }
            );

        }
    }

    /**
     * You can queue this function that will be
     * executed after all pending fetch tasks
     * are finished
     * @param fx any function
     */
    public runAfterEnd(fx: () => any) {
        (async () => {
            for(;;) {
                await sleep(100);
                if (this.running.size > 0) {
                    continue;
                }
                await sleep(10);
                if (this.running.size > 0) {
                    continue;
                }
                break;
            }
            fx();
        })().catch(console.error);
    }

}