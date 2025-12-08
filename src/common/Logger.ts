import { RegisterSingleton } from "../di/di.js";
import EALogger from "./EALogger.js";
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

    warn(a) {
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

    constructor(debugEnabled = false) {
        super();
        if (!debugEnabled) {
            this.debug = () => this;
        }
    }

    log(a) {
        console.log(a);
        return this;
    }

    error(a) {
        EALogger.error(a.stack ?? a);
        return this;
    }

    debug(a: any) {
        console.debug(a);
        return this;
    }

    warn(a: any) {
        console.warn(a);
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

    debug(a: any): this {
        this.items.push({ debug: a});
        return this;
    }

    warn(a: any): this {
        this.items.push({ warn: a});
        return this;
    }

    [Symbol.dispose](): void {
        for (const { log, error, debug, warn } of this.items) {
            if (debug) {
                this.parent.debug(debug);
                continue;
            }
            if (log) {
                this.parent.log(log);
                continue;
            }
            if (warn) {
                this.parent.warn(warn);
                continue;
            }
            if (error) {
                this.parent.error(error);
                continue;
            }
        }
    }

}