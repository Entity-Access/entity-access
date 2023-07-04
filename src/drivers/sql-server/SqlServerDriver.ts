import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import { BaseDriver, IDbConnectionString, IDbReader, IQuery, toQuery } from "../base/BaseDriver.js";
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

        rq.stream = true;

        const state = {
            pending: [],
            ended: false,
            error: null,
            count: 0,
            processPendingRows: () => void 0
        };

        rq.on("row", (row) => {
            state.pending.push(row);
            state.count++;
            state.processPendingRows();
        });

        rq.on("error", (e) => {
            state.error = new Error(`Failed executing ${(command as any).text}\r\n${e.stack ?? e}`);
            state.processPendingRows();
        });

        rq.on("done", () => {
            state.ended = true;
            state.processPendingRows();
        });

        console.log(`Executing ${command.text}`);
        void rq.query((command as any).text);

        return {
            async *next(min, s = signal) {

                s?.addEventListener("abort", () => {
                    rq.cancel();
                });

                do {
                    const r = await new Promise<{ rows?: any[], done?: boolean}>((resolve, reject) => {

                        state.processPendingRows = () => {
                            if(state.pending.length) {
                                const rows = [... state.pending];
                                state.pending.length = 0;
                                resolve({ rows });
                                return;
                            }
                            if(state.error) {
                                reject(state.error);
                                return;
                            }
                            if (state.ended) {
                                resolve({ done: true });
                                return;
                            }
                        };

                        state.processPendingRows();

                    });
                    if (r.rows?.length) {
                        yield *r.rows;
                    }
                    if (r.done) {
                        break;
                    }
                }  while(true);
            },
            dispose() {
                // node sql server library does not
                // required to be closed
                return Promise.resolve();
            },
        };
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
            console.log(command.text);
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