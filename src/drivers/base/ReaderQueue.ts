export default abstract class ReaderQueue {

    private resolve: (items: any[]) => void;
    private reject: (reason?: any) => void;
    private ended: boolean;
    private signal: AbortSignal;
    private waiting: Promise<any[]>;
    private queue: any[] = [];

    constructor() {
        this.waiting = new Promise<any[]>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    async *next(min: number, s?: AbortSignal) {
        this.begin(s);
        for(;;) {
            const items = await this.waitForItems(s);
            this.queue = [];
            yield *items;
            if (this.ended) {
                return;
            }
        }
    }

    protected abstract begin(s: AbortSignal);

    protected addItems(items: any[]) {
        this.waiting = null;
        this.queue.push(... items);
        this.resolve(this.queue);
    }

    protected failed(reason) {
        this.waiting = null;
        this.reject(reason);
    }

    protected end() {
        this.ended = true;
        this.waiting = null;
        this.resolve(this.queue);
    }

    protected async drain() {
        if (this.signal?.aborted) {
            return;
        }
        if (this.ended) {
            return;
        }
        for(;;) {
            if (this.ended) {
                return;
            }
            await this.waitForItems();
        }
    }

    private waitForItems(signal?: AbortSignal) {
        this.signal = signal;
        return this.waiting ??= new Promise<any[]>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

}