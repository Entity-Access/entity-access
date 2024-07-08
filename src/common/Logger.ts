import { RegisterSingleton } from "../di/di.js";
import { IDisposable } from "./IDisposable.js";

/* eslint-disable no-console */
@RegisterSingleton
export default class Logger implements IDisposable {

    public static nullLogger = new Logger();

    public static get instance() {
        return this.globalInstance ??= new ConsoleLogger();
    }
    private static globalInstance: ConsoleLogger;

    log(a) {
        return this;
    }

    debug(a) {
        return this;
    }

    error(a) {
        return this;
    }

    newSession() {
        return new SessionLogger(this);
    }

    [Symbol.dispose]() {
        // do nothing...
    }
}

export class ConsoleLogger extends Logger {

    log(a) {
        console.log(a);
        return this;
    }

    error(a) {
        console.error(a.stack ?? a);
        return this;
    }

    debug(a: any) {
        console.debug(a);
        return this;
    }

    newSession() {
        return new SessionLogger(this);
    }

    [Symbol.dispose]() {
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

    [Symbol.dispose](): void {
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