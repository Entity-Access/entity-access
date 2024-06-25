/* eslint-disable no-console */
import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import { BaseConnection, BaseDriver, EntityTransaction, IBaseTransaction, IDbConnectionString, IDbReader, IQuery, IRecord, toQuery } from "../base/BaseDriver.js";
import sql from "mssql";
import SqlServerQueryCompiler from "./SqlServerQueryCompiler.js";
import SqlServerAutomaticMigrations from "../../migrations/sql-server/SqlServerAutomaticMigrations.js";
import { SqlServerLiteral } from "./SqlServerLiteral.js";
import TimedCache from "../../common/cache/TimedCache.js";

export type ISqlServerConnectionString = IDbConnectionString & sql.config;

const namedPool = new TimedCache<string, sql.ConnectionPool>();

export default class SqlServerDriver extends BaseDriver {

    get compiler(): QueryCompiler {
        return this.sqlQueryCompiler;
    }

    private sqlQueryCompiler = new SqlServerQueryCompiler();

    constructor(private readonly config: ISqlServerConnectionString) {
        super(config);
        config.server = config.host;
    }

    dispose() {
        // do nothing
    }

    newConnection(): BaseConnection {
        return new SqlServerConnection(this, this.config);
    }
}

export class SqlServerConnection extends BaseConnection {

    private transaction: sql.Transaction;

    private get sqlQueryCompiler() {
        return this.compiler as SqlServerQueryCompiler;
    }

    constructor(driver, private config: ISqlServerConnectionString) {
        super(driver);
    }

    public async executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        command = toQuery(command);
        let rq = await this.newRequest(signal);

        if (command) {
            let id = 1;
            for (const iterator of command.values) {
                command.text = command.text.replace(/\$/, "@p");
                rq = rq.input("p" + id++, iterator);
            }
        }

        return new SqlReader(rq, command);
    }
    public async executeQuery(command: IQuery, signal?: AbortSignal): Promise<any> {
        let rq = await this.newRequest(signal);
        command = toQuery(command);

        if (command) {
            let id = 1;
            for (const iterator of command.values) {
                command.text = command.text.replace(/\$/, "@p");
                rq = rq.input(`p${id++}`, iterator);
            }
        }

        try {
            const r = await rq.query(command.text);
            const rows = r.recordset ?? [r.output];
            if (rows.length === 0) {
                // do something..
                const { recordsets } = r as any;
                for (let index = 0; index < recordsets.length; index++) {
                    const element = r.recordsets[index];
                    rows.push(...element);
                }
            }
            return { rows, updated: r.rowsAffected [0]};
        } catch (error) {
            error = `Failed executing ${command.text}\r\n${error.stack ?? error}`;
            console.error(error);
            throw new Error(error);
        }
    }

    public ensureDatabase() {
        const create = async () => {
            const config = { ... this.config, database: "master" };
            const db = this.config.database;

            const connection = await this.newConnection(config);

            const createSql = `IF NOT EXISTS (SELECT name FROM master.dbo.sysdatabases WHERE name = ${SqlServerLiteral.escapeLiteral(db)}) BEGIN
                CREATE DATABASE ${db};
            END`;
            try {
                await connection.query(createSql);
            } catch(error) {
                throw new Error(`Failed executing: ${createSql}\r\n${error.stack ?? error}`);
            }
        };
        const value = create();
        Object.defineProperty(this, "ensureDatabase", {
            value: () => value,
        });
        return value;
    }

    public async createTransaction(): Promise<EntityTransaction> {
        this.transaction = new sql.Transaction(await this.newConnection());
        let rolledBack = false;
        this.transaction.on("rollback", (aborted) => rolledBack = aborted);
        await this.transaction.begin();
        return new EntityTransaction({
            commit: () => this.transaction.commit(),
            rollback: async () => !rolledBack && await this.transaction.rollback(),
            dispose: () => this.transaction = void 0
        });
    }

    public automaticMigrations(): Migrations {
        return new SqlServerAutomaticMigrations(this.sqlQueryCompiler);
    }

    protected async newRequest(signal: AbortSignal) {
        let request: sql.Request;
        if (this.transaction) {
            request = this.transaction.request();
        } else {
            request = (await this.newConnection()).request();
        }
        // request.verbose = true;
        if (signal) {
            if (signal.aborted) {
                request.cancel();
                signal.throwIfAborted();
            }
            signal.onabort = () => request.cancel();
        }
        return request;
    }

    private newConnection(config = this.config) {
        const key = config.server + "//" + config.database + "/" + config.user;
        return namedPool.getOrCreateAsync(config.server + "://" + config.database,
            () => {
                const pool = new sql.ConnectionPool(config);
                const oldClose = pool.close;
                pool.close = ((c) => {
                    namedPool.delete(key);
                    return oldClose.call(pool, c);
                }) as any;
                return pool.connect();
            }, 15000, (x) => x.close());

    }

}

class SqlReader implements IDbReader {

    private pending: any[] = [];
    private error: any = null;
    private count: number = 0;
    private ended = false;
    private processPendingRows: (... a: any[]) => any;
    private errorHandler: (e: any) => any;

    constructor(
        private rq: sql.Request,
        private command: { text: string, values?: any[]}) {}

    async *next(min?: number, s?: AbortSignal) {
        const command = this.command;
        const rq = this.rq;
        s?.addEventListener("abort", () => {
            rq.cancel();
        });

        rq.stream = true;

        rq.on("row", (row) => {
            this.pending.push(row);
            this.count++;
            this.processPendingRows();
        });

        rq.on("error", (e) => {
            this.error = new Error(`Failed executing ${command.text}\r\n${e.stack ?? e}`);
            this.errorHandler?.(this.error);
            // this.processPendingRows();
        });

        rq.on("done", () => {
            this.ended = true;
            this.processPendingRows();
        });

        void rq.query((command as any).text);

        do {
            if (this.pending.length > 0){
                const copy = this.pending;
                this.pending = [];
                yield *copy;
            }
            if (this.ended) {
                break;
            }
            await new Promise<any>((resolve, reject) => {
                this.processPendingRows = resolve;
                this.errorHandler = reject;
            });
        }  while(true);
    }
    dispose(): Promise<any> {
        // if (!this.ended) {
        //     this.rq.cancel();
        // }
        return Promise.resolve();
    }
    [Symbol.asyncDispose]() {
        return this.dispose()?.catch((error) => console.error(error));
    }

}