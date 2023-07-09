import { IDisposable } from "./IDisposable.js";

/* eslint-disable no-console */
export default class Logger implements IDisposable {

    public static instance = new Logger();

    log(a) {
        console.log(a);
        return this;
    }

    error(a) {
        console.error(a);
        return this;
    }

    newSession() {
        return new SessionLogger(this);
    }

    dispose() {
        // do nothing...
    }
}

class SessionLogger extends Logger {
    private items = [];

    constructor(private parent: Logger) {
        super();
    }

    log(a) {
        this.items.push({ log: a});
        return this;
    }

    error(a: any) {
        this.items.push({ error: a});
        return this;
    }

    dispose(): void {
        for (const { log, error } of this.items) {
            if (log) {
                this.parent.log(log);
                continue;
            }
            if (error) {
                this.parent.error(error);
                continue;
            }
        }
    }

}