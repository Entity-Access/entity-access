import EntityType from "../../entity-query/EntityType.js";
import { Query } from "../../query/Query.js";

const disposableSymbol: unique symbol = (Symbol as any).dispose ??= Symbol("disposable");

interface IDisposable {
    [disposableSymbol]?(): void;
}

export interface IRecord {
    [key: string]: string | boolean | number | Date | Uint8Array | Blob;
}

export interface IDbConnectionString {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
}

export interface IDbReader extends IDisposable {
    next(min?: number): AsyncGenerator<IRecord, any, any>;
    dispose(): Promise<any>;
}

export interface IQueryTask {
    query: Query;
    postExecution?: ((r: any) => Promise<any>);
}

export abstract class BaseDriver {

    constructor(public readonly connectionString: IDbConnectionString) {}

    public abstract escape(name: string);

    public abstract executeReader(command: Query): Promise<IDbReader>;

    public abstract executeNonQuery(command: Query);

    abstract createInsert(type: EntityType, entity: any): IQueryTask;
}
