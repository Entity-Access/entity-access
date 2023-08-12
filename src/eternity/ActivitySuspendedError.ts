import TimeSpan from "../types/TimeSpan.js";


export class ActivitySuspendedError extends Error {

    constructor(public ttl: TimeSpan = TimeSpan.fromDays(1)) {
        super("Activity Suspended");
    }

}
