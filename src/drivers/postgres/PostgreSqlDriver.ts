/* eslint-disable no-console */
import ObjectPool, { IPooledObject } from "../../common/ObjectPool.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import PostgresAutomaticMigrations from "../../migrations/postgres/PostgresAutomaticMigrations.js";
import { BaseConnection, BaseDriver, IBaseTransaction, IDbConnectionString, IDbReader, IQuery, IRecord, toQuery } from "../base/BaseDriver.js";
import pg from "pg";
import Cursor from "pg-cursor";
export interface IPgSqlConnectionString extends IDbConnectionString {

    user?: string, // default process.env.PGUSER || process.env.USER
    password?: string, // default process.env.PGPASSWORD
    host?: string, // default process.env.PGHOST
    database?: string, // default process.env.PGDATABASE || user
    port?: number, // default process.env.PGPORT
    connectionString?: string, // e.g. postgres://user:password@host:5432/database
    ssl?: any, // passed directly to node.TLSSocket, supports all tls.connect options
    types?: any, // custom type parsers
    statement_timeout?: number, // number of milliseconds before a statement in query will time out, default is no timeout
    query_timeout?: number, // number of milliseconds before a query call will timeout, default is no timeout
    application_name?: string, // The name of the application that created this Client instance
    connectionTimeoutMillis?: number, // number of milliseconds to wait for connection, default is no timeout
    idle_in_transaction_session_timeout?: number // number of milliseconds before terminating any session with an open idle transaction, default is no timeout
};

const pgID = Symbol("pgID");

class DbReader implements IDbReader {

    cursor: Cursor<any>;
    client: IPooledObject<pg.Client>;

    constructor(
        private command: IQuery,
        private connection: PostgreSqlConnection,
        private signal?: AbortSignal) {

    }

    async *next(min = 100) {

        const connection = await this.connection.getConnection(this.signal);
        if (!this.connection.isInTransaction) {
            this.client = connection;
        }
        const q = toQuery(this.command);
        const cursor = this.cursor = connection.query(new Cursor(q.text, q.values));
        do {
            const rows = await cursor.read(min);
            yield *rows;
            if (rows.length === 0) {
                break;
            }
        } while (true);
    }

    async dispose() {
        try {
            await this.cursor.close();
        } catch (error) {
            console.error(error.stack ?? error);
        }

        try {
            if (this.client) {
                await this.client[Symbol.asyncDisposable]();
            }
        } catch (error) {
            console.error(error.stack ?? error);
        }
    }
}

export default class PostgreSqlDriver extends BaseDriver {

    public get compiler() {
        return this.myCompiler;
    }

    private myCompiler = new QueryCompiler();

    private pool: ObjectPool<pg.Client>;

    constructor(private readonly config: IPgSqlConnectionString) {
        super(config);
        this.pool = new ObjectPool({
            asyncFactory: async () => {
                const c = new pg.Client(this.config);
                await c.connect();
                const row = await c.query("SELECT pg_backend_pid() as id");
                c[pgID] = (row.rows as any).id;
                return c;
            },
            destroy(item) {
                return item.end();
            },
            subscribeForRemoval(po, clear) {
                po.on("end", clear);
            },
        });
    }

    dispose() {
        this.pool?.dispose().catch(console.error);
    }

    newConnection(): BaseConnection {
        return new PostgreSqlConnection(this, this.pool);
    }
}

class PostgreSqlConnection extends BaseConnection {

    public get isInTransaction() {
        return this.transaction as any as boolean;
    }

    private transaction: IPooledObject<pg.Client>;

    private get config() {
        return this.connectionString;
    }

    constructor(driver: BaseDriver, private pool: ObjectPool<pg.Client>) {
        super(driver);
    }

    public async createTransaction(): Promise<IBaseTransaction> {
        const tx = await this.getConnection();
        await tx.query("BEGIN");
        return {
            commit: () => tx.query("COMMIT"),
            rollback: () => tx.query("ROLLBACK"),
            dispose: () => {
                this.transaction = null;
                return tx[Symbol.asyncDisposable]();
            }
        };
    }

    public automaticMigrations(): Migrations {
        return new PostgresAutomaticMigrations(this.compiler);
    }

    public async executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        return new DbReader(command, this, signal);
    }

    public async executeQuery(command: IQuery, signal?: AbortSignal) {
        const connection = await this.getConnection(signal);
        let text = "";
        // we need to change parameter styles
        try {
            const q = toQuery(command);
            text = q.text;
            const result = await connection.query(q.text, q.values);
            (result as any).updated = result.rowCount;
            return result;
        } catch (error) {
            throw new Error(`Failed executing ${text}\n${error}`);
        } finally {
            if (!this.transaction) {
                await connection[Symbol.asyncDisposable]();
            }
        }
    }

    public ensureDatabase() {
        const create = async () => {
            try {
                // const defaultDb = "postgres";
                const db = this.config.database;
                // this.config.database = defaultDb;
                // // const connection = await this.getConnection();
                // // @ts-expect-error readonly
                // this.config = { ... this.config };
                // this.config.database = db;
                const connection = new pg.Client({ ... this.config, database: "postgres" });
                await connection.connect();
                try {
                    const r = await connection.query("SELECT FROM pg_database WHERE datname = $1", [ db ]);
                    if(r.rowCount === 1) {
                        return;
                    }
                    await connection.query(`CREATE DATABASE "${db}"`);
                } finally {
                    await connection.end();
                }
            } catch (error) {
                console.error(error.stack ?? error);
                throw error;
            }
        };
        const value = create();
        Object.defineProperty(this, "ensureDatabase", {
            value: () => value,
        });
        return value;
    }


    public async getConnection(signal?: AbortSignal) {

        if (signal?.aborted) {
            throw new Error("Aborted");
        }

        if (this.transaction) {
            return this.transaction;
        }

        const client = await this.pool.acquire();

        if (signal) {
            signal.addEventListener("abort", () => this.kill(client[pgID]).catch((error) => console.error(error)));
        }
        return client;
    }

    private async kill(id) {
        const client = new pg.Client(this.config);
        try {
            await client.connect();
            await client.query("SELECT pg_cancel_backend($1)", [id]);
        } catch (error) {
            console.error(error);
        } finally {
            await client.end();
        }
    }
}