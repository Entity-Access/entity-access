import { IDisposable, disposeDisposable } from "../common/IDisposable.js";
import { IAbstractClassOf, IClassOf } from "../decorators/IClassOf.js";

import "reflect-metadata";

export type ServiceKind = "Singleton" | "Transient" | "Scoped";

const registrations = new Map<any,IServiceDescriptor>();

export const injectServiceTypesSymbol = Symbol("injectServiceTypes");
export const injectServiceKeysSymbol = Symbol("injectServiceKeys");

const registrationsSymbol = Symbol("registrations");

const serviceProvider = Symbol("serviceProvider");

const globalServiceProvider = Symbol("globalInstance");

export class ServiceProvider implements IDisposable {

    public static from(owner: any) {
        return (owner[serviceProvider]) as ServiceProvider;
    }

    public static resolve<T>(serviceOwner: any, type: IClassOf<T>): T {
        const sp = serviceOwner[serviceProvider] as ServiceProvider;
        return sp.resolve(type);
    }

    static create<T>(serviceOwner, type: IClassOf<T>): T {
        const sp = serviceOwner[serviceProvider] as ServiceProvider;
        return sp.createFromType(type);
    }

    static createScope<T>(serviceOwner): ServiceProvider {
        const sp = serviceOwner[globalServiceProvider] as ServiceProvider;
        return sp.createScope();
    }

    private map: Map<any,any> = new Map();
    private disposables: IDisposable[];

    constructor(parent?: ServiceProvider) {
        this[serviceProvider] = this;
        this[globalServiceProvider] = parent?.[globalServiceProvider] ?? this;
        this.map.set(ServiceProvider, this);
    }

    add<T1, T extends T1>(type: IAbstractClassOf<T1> | IClassOf<T1>, instance: T) {
        this.getRegistration(type, true);
        this.map.set(type, instance);
        instance[serviceProvider] = this;
        instance[globalServiceProvider] = this[globalServiceProvider];
        this.resolveProperties(instance);
        return instance;
    }


    createScope() {
        return new ServiceProvider(this);
    }

    create<T>(type: IClassOf<T>): T {
        return this.createFromType(type);
    }


    resolve<T>(type: IClassOf<T>): T {
        let instance;
        const sd = this.getRegistration(type);
        switch(sd.kind) {
            case "Scoped":
                if (this[globalServiceProvider] === this) {
                    throw new Error(`Unable to create scoped service ${type?.name ?? type} in global scope.`);
                }
                instance = this.map.get(type);
                if (!instance) {
                    instance = this.createFromDescriptor(sd);
                    this.map.set(type, instance);
                    instance[serviceProvider] = this;
                    instance[globalServiceProvider] = this[globalServiceProvider];
                    if (instance[Symbol.disposable] || instance[Symbol.asyncDisposable]) {
                        (this.disposables ??= []).push(instance);
                    }
                }
                return  instance;
            case "Singleton":
                const sp = this[globalServiceProvider];
                instance = sp.map.get(type);
                if (!instance) {
                    instance = sp.createFromDescriptor(sd);
                    instance[serviceProvider] = this;
                    instance[globalServiceProvider] = sp;
                    sp.map.set(type, instance);
                    if (instance[Symbol.disposable] || instance[Symbol.asyncDisposable]) {
                        (sp.disposables ??= []).push(instance);
                    }
                }
                return  instance;
            case "Transient":
                instance = this.createFromDescriptor(sd);
                instance[serviceProvider] = this;
                instance[globalServiceProvider] = sp;
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
                const registration: IServiceDescriptor = { key: type, kind: this[globalServiceProvider] !== this ? "Scoped" : "Singleton" };
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
            const instance = sd.factory(this);
            instance[serviceProvider] = this;
            instance[globalServiceProvider] = this[globalServiceProvider];
            // initialize properties...
            this.resolveProperties(instance);
            return instance;
        }
        return this.createFromType(sd.key);
    }

    private resolveProperties(instance, type?) {
        type ??= Object.getPrototypeOf(instance).constructor;
        const keys = type.prototype[injectServiceKeysSymbol];
        if (keys) {
            for (const key in keys) {
                if (Object.prototype.hasOwnProperty.call(keys, key)) {
                    const element = keys[key];
                    instance[key] ??= this.resolve(element);
                }
            }
        }
    }

    private createFromType(type): any {
        const injectTypes = type[injectServiceTypesSymbol] as any[];
        const injectServices = injectTypes
            ? injectTypes.map((x) => this.resolve(x))
            : [];
        const instance = new type(... injectServices);
        instance[serviceProvider] = this;
        instance[globalServiceProvider] = this[globalServiceProvider];
        // initialize properties...
        this.resolveProperties(instance, type);
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

// const injectedMethodSymbol = Symbol("injectedMethod");

// interface IInjectedFunction {
//     (... a: any[]): any;
//     [injectedMethodSymbol]?: { [key: string]: any };
// }

// function createInjectedMethod(target: any, methodName: string, parameterIndex: number, plist: any[]) {
//     const method = target[methodName] as IInjectedFunction;
//     let value = method;
//     let parameterTypes = method[injectedMethodSymbol];
//     if (!parameterTypes) {
//         parameterTypes = [];
//         function injectedMethod(... a: any[]) {
//             for (let index = a.length; index < parameterTypes.length; index++) {
//                 const element = parameterTypes[index];
//                 a.push(ServiceProvider.resolve(this, element));
//             }
//             return method.apply(this, a);
//         };
//         target[methodName] = injectedMethod;
//         value = injectedMethod;
//         return {
//             value,
//             enumerable: true,
//             configurable: true
//         };
//     }
//     parameterTypes[parameterIndex] = plist[parameterIndex];
// }

export default function Inject(target, key, index?: number): any {

    if (index !== void 0) {

        if (key) {

            // this is parameter inside a method...
            const plist = (Reflect as any).getMetadata("design:paramtypes", target, key);
            // return createInjectedMethod(target, key, index, plist);
            const method = target[key];
            const pTypes = (method[injectServiceKeysSymbol] ??= []);
            pTypes[index] = plist[index];
        } else {

            const plist = (Reflect as any).getMetadata("design:paramtypes", target, key);
            const serviceTypes = target[injectServiceTypesSymbol] ??= [];
            serviceTypes[index] = plist[index];
        }

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