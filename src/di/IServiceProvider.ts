import { IClassOf } from "../decorators/IClassOf.js";

export interface IServiceProvider {
    resolve<T>(type: IClassOf<T>):T;
}