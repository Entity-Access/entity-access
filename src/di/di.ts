import { IDisposable, disposeDisposable } from "../common/IDisposable.js";
import { IClassOf } from "../decorators/IClassOf.js";

import "reflect-metadata";

export type ServiceKind = "Singleton" | "Transient" | "Scoped";

const registrations = new Map<any,IServiceDescriptor>();

export const injectServiceTypesSymbol = Symbol("injectServiceTypes");

const registrationsSymbol = Symbol("registrations");

const serviceProvider = Symbol("serviceProvider");

const parentServiceProvider = Symbol("parentServiceProvider");

export class ServiceProvider implements IDisposable {

    public static global = new ServiceProvider();

    public static resolve<T>(serviceOwner: any, type: IClassOf<T>) {
        const sp = serviceOwner[serviceProvider] as ServiceProvider;
        return sp.resolve(type);
    }

    private map: Map<any,any> = new Map();
    private disposables: IDisposable[];

    constructor(parent?: ServiceProvider) {
        this[serviceProvider] = this;
        this[parentServiceProvider] = parent;
    }

    resolve(type) {
        let instance: any;
        const sd = registrations.get(type);
        if (!sd) {
            throw new Error(`No service registered for ${type?.name ?? type}`);
        }
        switch(sd.kind) {
            case "Scoped":
                if (!this[parentServiceProvider]) {
                    throw new Error(`Unable to create scoped service ${type?.name ?? type} in global scope.`);
                }
                instance = this.map.get(type);
                if (!instance) {
                    instance = this.create(sd);
                    this.map.set(type, instance);
                    instance[serviceProvider] = this;
                    if (instance[Symbol.disposable] || instance[Symbol.asyncDisposable]) {
                        (this.disposables ??= []).push(instance);
                    }
                }
                return  instance;
            case "Singleton":
                let sp = this;
                while (sp[parentServiceProvider]) {
                    sp = sp[parentServiceProvider];
                }
                instance = sp.map.get(type);
                if (!instance) {
                    instance = sp.create(sd);
                    instance[serviceProvider] = sp;
                    sp.map.set(type, instance);
                    if (instance[Symbol.disposable] || instance[Symbol.asyncDisposable]) {
                        (sp.disposables ??= []).push(instance);
                    }
                }
                return  instance;
            case "Transient":
                instance = sp.create(sd);
                instance[serviceProvider] = sp;
                return instance;
        }
    }

    dispose() {
        this[Symbol.disposable]();
    }

    [Symbol.disposable]() {
        const disposables = this.disposables;
        if (!disposables) {
            return;
        }
        for (const iterator of disposables) {
            disposeDisposable(iterator);
        }
    }

    private create(sd: IServiceDescriptor): any {
        if(sd.factory) {
            return sd.factory(this);
        }
        const injectTypes = sd.key[injectServiceTypesSymbol] as any[];
        const injectServices = injectTypes
            ? injectTypes.map((x) => this.resolve(x))
            : [];
        return new sd.key(... injectServices);
    }
}

export interface IServiceDescriptor {

    key: any;
    kind: ServiceKind;
    instance?: any;
    factory?: (sp: ServiceProvider) => any;
}


export const ServiceCollection = {
    register(kind: ServiceKind, key, factory?: (sp: ServiceProvider) => any) {
        registrations.set(key, { kind, key, factory});
    },
    [registrationsSymbol]: registrations
};

export default function Inject(target, key, index?: number) {

    if (index !== void 0) {
        const plist = (Reflect as any).getMetadata("design:paramtypes", target, key);
        const serviceTypes = target[injectServiceTypesSymbol] ??= [];
        serviceTypes[index] = plist[index];
        return;
    }

    Object.defineProperty(target, key, {
        get() {
            const plist = (Reflect as any).getMetadata("design:type", target, key);
            const result = ServiceProvider.resolve(this, plist);
            // get is compatible with AtomWatcher
            // as it will ignore getter and it will
            // not try to set a binding refresher
            Object.defineProperty(this, key, {
                get: () => result
            });
            return result;
        },
        configurable: true
    });


}

export function Register(kind: ServiceKind, factory?: (sp: ServiceProvider) => any) {
    return function(target) {
        ServiceCollection.register(kind, target, factory);
    };
}

export const RegisterSingleton = Register("Singleton");

export const RegisterScoped = Register("Scoped");

export const RegisterTransient = Register("Transient");