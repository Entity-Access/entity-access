import { RegisterScoped } from "../../../di/di.js";

@RegisterScoped
export class UserInfo {
    public userID: number;
    public admin: boolean;
}