/* eslint-disable no-console */
import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import { BaseDriver, IDbConnectionString, IDbReader, IQuery, IRecord, disposableSymbol, toQuery } from "../base/BaseDriver.js";
import sql from "mssql";
import SqlServerQueryCompiler from "./SqlServerQueryCompiler.js";
import SqlServerSqlMethodTransformer from "../../compiler/sql-server/SqlServerSqlMethodTransformer.js";
import SqlServerAutomaticMigrations from "../../migrations/sql-server/SqlServerAutomaticMigrations.js";
import { SqlServerLiteral } from "./SqlServerLiteral.js";
import usingAsync from "../../common/usingAsync.js";
import TimedCache from "../../common/cache/TimedCache.js";

export type ISqlServerConnectionString = sql.config;

const namedPool = new TimedCache<string, sql.ConnectionPool>();

export default class SqlServerDriver extends BaseDriver {

    get compiler(): QueryCompiler {
        return this.sqlQueryCompiler;
    }

    private sqlQueryCompiler = new SqlServerQueryCompiler();
    private transaction: sql.Transaction;

    constructor(private readonly config: ISqlServerConnectionString) {
        super({
            database: config.database,
            host: config.server ??= (config as any).host,
            port: config.port,
            password: config.password,
            user: config.user,
            ... config,
        });
    }

    public async executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        command = toQuery(command);
        let rq = await this.newRequest();

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
        let rq = await this.newRequest();
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
            return { rows: r.recordset ?? [r.output], updated: r.rowsAffected [0]};
        } catch (error) {
            error = `Failed executing ${command.text}\r\n${error.stack ?? error}`;
            console.error(error);
            throw new Error(error);
        }
    }

    public ensureDatabase() {
        const create = async () => {
            const defaultDb = "master";

            const db = this.config.database;
            this.config.database = defaultDb;

            const connection = await this.newRequest();
            // @ts-expect-error readonly
            this.config = { ... this.config };
            this.config.database = db;

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

    public async runInTransaction<T = any>(fx?: () => Promise<T>): Promise<T> {
        this.transaction = new sql.Transaction(await this.newConnection());
        let rolledBack = false;
        try {
            this.transaction.on("rollback", (aborted) => rolledBack = aborted);
            await this.transaction.begin();
            const r = await fx();
            await this.transaction.commit();
            return r;
        } catch (error) {
            if (!rolledBack) {
                try {
                    await this.transaction.rollback();
                } catch {
                    // rolledBack isn't true sometimes...
                }
            }
            throw new Error(error.stack ?? error);
        } finally {
            this.transaction = void 0;
        }
    }

    public automaticMigrations(): Migrations {
        return new SqlServerAutomaticMigrations();
    }

    protected async newRequest() {

        if (this.transaction) {
            return this.transaction.request();
        }
        return (await this.newConnection()).request();
    }

    private newConnection() {
        const key = this.config.server + "//" + this.config.database + "/" + this.config.user;
        return namedPool.getOrCreateAsync(this.config.server + "://" + this.config.database,
            () => {
                const pool = new sql.ConnectionPool(this.config);
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
            this.processPendingRows();
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
            });
        }  while(true);
    }
    dispose(): Promise<any> {
        return Promise.resolve();
    }
    [disposableSymbol]?(): void {
        this.dispose()?.catch((error) => console.error(error));
    }

}