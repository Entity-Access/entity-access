export type ServiceKind = "Singleton" | "Transient" | "Scoped";

export const servicesSymbol = Symbol("services");

export interface IServiceDescriptor {
    key: any;
    factory: () => any;
    kind: ServiceKind;
    instance?: any;
}

export class ServiceProvider {

}

export default class ServiceCollection {

    public static instance: ServiceCollection = new ServiceCollection();

    public static newScope() {
        return new Scope();
    }

    static resolve(scope: any, key: any) {
        const services = (scope?.[servicesSymbol] ?? ServiceCollection.instance) as ServiceCollection;
        return services.resolve(key);
    }

    public static register(kind: ServiceKind, key, factory: () => any = this.create(this, key)) {
        this.registrations.set(key, { key, kind, factory});
        return this;
    }

    private static registrations: Map<any, IServiceDescriptor> = new Map();

    private static create(services, key: any): () => any {
        const service = new key();
        service[servicesSymbol] = services;
        return key;
    }

    protected instances: Map<any,any> = new Map();

    protected resolve(key: any) {
        let instance = this.instances.get(key);
        if (instance) {
            return instance;
        }
        const registration = ServiceCollection.registrations.get(key);
        if (!registration) {
            throw new Error(`No registration found for ${key}`);
        }
        if (registration.kind === "Singleton") {
            instance = registration.factory();
            this.instances.set(key, instance);
            return instance;
        }
        if (registration.kind === "Transient") {
            return registration.factory();
        }
        if (this === ServiceCollection.instance) {
            throw new Error(`Unable to create scoped instance for ${key} globally.`);
        }
        instance = registration.factory();
        this.instances.set(key, instance);
        return instance;
    }

}

export class Scope extends ServiceCollection {

    dispose() {
        for (const iterator of this.instances.values()) {
            const r = iterator?.dispose?.();
            r?.catch((error) => console.error(error));
        }
    }

}
