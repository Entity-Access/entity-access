import { IDisposable, disposeDisposable } from "../common/IDisposable.js";
import { IAbstractClassOf, IClassOf } from "../decorators/IClassOf.js";

import "reflect-metadata";
import EntityContext from "../model/EntityContext.js";
import { BaseDriver } from "../drivers/base/BaseDriver.js";

export type ServiceKind = "Singleton" | "Transient" | "Scoped";

const registrations = new Map<any,IServiceDescriptor>();

export const injectServiceTypesSymbol = Symbol("injectServiceTypes");
export const injectServiceKeysSymbol = Symbol("injectServiceKeys");

const registrationsSymbol = Symbol("registrations");

const serviceProvider = Symbol("serviceProvider");

const parentServiceProvider = Symbol("parentServiceProvider");

export class ServiceProvider implements IDisposable {

    public static global = new ServiceProvider();

    public static resolve<T>(serviceOwner: any, type: IClassOf<T>): T {
        const sp = (serviceOwner[serviceProvider] ?? this.global) as ServiceProvider;
        return sp.resolve(type);
    }

    static create<T>(serviceOwner, type: IClassOf<T>): T {
        const sp = (serviceOwner[serviceProvider] ?? this.global) as ServiceProvider;
        return sp.createFromType(type);
    }


    private map: Map<any,any> = new Map();
    private disposables: IDisposable[];

    constructor(parent?: ServiceProvider) {
        this[serviceProvider] = this;
        this[parentServiceProvider] = parent;
    }

    // add<T1, T extends T1>(type: IAbstractClassOf<T1> | IClassOf<T1>, instance: T) {
    //     this.getRegistration(type, true);
    //     this.map.set(type, instance);
    //     instance[serviceProvider] = this;
    //     return instance;
    // }


    createScope() {
        return new ServiceProvider(this);
    }

    create<T>(type: IClassOf<T>): T {
        return this.createFromType(type);
    }


    resolve(type) {
        let instance;
        const sd = this.getRegistration(type);
        switch(sd.kind) {
            case "Scoped":
                if (!this[parentServiceProvider]) {
                    throw new Error(`Unable to create scoped service ${type?.name ?? type} in global scope.`);
                }
                instance = this.map.get(type);
                if (!instance) {
                    instance = this.createFromDescriptor(sd);
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
                    instance = sp.createFromDescriptor(sd);
                    instance[serviceProvider] = sp;
                    sp.map.set(type, instance);
                    if (instance[Symbol.disposable] || instance[Symbol.asyncDisposable]) {
                        (sp.disposables ??= []).push(instance);
                    }
                }
                return  instance;
            case "Transient":
                instance = sp.createFromDescriptor(sd);
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

    private getRegistration(type: any, add = false) {
        let sd = registrations.get(type);
        if (!sd) {

            if (add) {
                const registration: IServiceDescriptor = { key: type, kind: this[parentServiceProvider] ? "Scoped" : "Singleton" };
                registrations.set(type, registration);
                return registration;
            }

            // we need to go through all services
            // to find the derived type
            for (const [key, value] of registrations.entries()) {
                if (key.prototype instanceof type) {
                    // we found the match..
                    registrations.set(type, { ...value, key: type });
                    sd = value;
                }
            }
            if (!sd) {
                throw new Error(`No service registered for ${type?.name ?? type}`);
            }
        }
        return sd;
    }

    private createFromDescriptor(sd: IServiceDescriptor): any {
        if(sd.factory) {
            return sd.factory(this);
        }
        return this.createFromType(sd.key);
    }

    private createFromType(type): any {
        const injectTypes = type[injectServiceTypesSymbol] as any[];
        const injectServices = injectTypes
            ? injectTypes.map((x) => this.resolve(x))
            : [];
        const instance = new type(... injectServices);
        instance[serviceProvider] = this;
        // initialize properties...
        const keys = type.prototype[injectServiceKeysSymbol];
        if (keys) {
            for (const key in keys) {
                if (Object.prototype.hasOwnProperty.call(keys, key)) {
                    const element = keys[key];
                    instance[key] = this.resolve(element);
                }
            }
        }
        return instance;
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

    const pType = (Reflect as any).getMetadata("design:type", target, key);
    (target[injectServiceKeysSymbol] ??= {})[key] = pType;
    Object.defineProperty(target, key, {
        get() {
            const result = ServiceProvider.resolve(this, pType);
            // get is compatible with AtomWatcher
            // as it will ignore getter and it will
            // not try to set a binding refresher
            Object.defineProperty(target, key, {
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