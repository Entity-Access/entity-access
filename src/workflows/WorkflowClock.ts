import { RegisterSingleton } from "../di/di.js";
import DateTime from "../types/DateTime.js";

@RegisterSingleton
export default class WorkflowClock {

    public get utcNow() {
        return DateTime.now;
    }
}