/* eslint-disable no-console */
import EntityAccessError from "../../common/EntityAccessError.js";
import IColumnSchema from "../../common/IColumnSchema.js";
import ObjectPool, { IPooledObject } from "../../common/ObjectPool.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import EntityType from "../../entity-query/EntityType.js";
import Migrations from "../../migrations/Migrations.js";
import PostgresAutomaticMigrations from "../../migrations/postgres/PostgresAutomaticMigrations.js";
import EntityContext from "../../model/EntityContext.js";
import DateTime from "../../types/DateTime.js";
import { BaseConnection, BaseDriver, EntityTransaction, IDbConnectionString, IDbReader, IQuery, toQuery } from "../base/BaseDriver.js";
import pg, { Pool, PoolClient } from "pg";
import PgPool from "pg-pool";
import Cursor from "pg-cursor";
import ExistingSchema from "../base/ExistingSchema.js";
import TimedCache from "../../common/cache/TimedCache.js";
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

pg.types.setTypeParser(pg.types.builtins.INT8, (n) => n === "0" ? 0 : n);

pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (n) =>
    new DateTime(n)
);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (n) =>
    new DateTime(n)
);
pg.types.setTypeParser(pg.types.builtins.DATE, (n) =>
    new DateTime(n)
);
pg.types.setTypeParser(pg.types.builtins.TIMETZ, (n) =>
    new DateTime(n)
);

pg.defaults.parseInputDatesAsUTC = true;

const namedPool = new TimedCache<string, Pool>();

// pg.types.setTypeParser(pg.types.builtins.NUMERIC, (n) => n ? Number(n) : 0);

class DbReader implements IDbReader {

    cursor: Cursor<any>;
    client: PoolClient;

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
            await this.cursor?.close();
        } catch (error) {
            console.error(error.stack ?? error);
        }

        try {
            if (this.client) {
                await this.client[Symbol.asyncDispose]();
            }
        } catch (error) {
            console.error(error.stack ?? error);
        }
    }

    [Symbol.asyncDispose]() {
        return this.dispose();
    }
}

const postGresQueryCompiler = new QueryCompiler();

export default class PostgreSqlDriver extends BaseDriver {

    public get compiler() {
        Object.defineProperty(this, "compiler", { value: postGresQueryCompiler, configurable: true });
        return postGresQueryCompiler;
    }

    constructor(private readonly config: IPgSqlConnectionString) {
        super(config);
        // config.poolSize ??= 20;
        // this.pool = new ObjectPool({
        //     poolSize: config.poolSize,
        //     maxSize: (config.poolSize) * 10,
        //     asyncFactory: async () => {
        //         const c = new pg.Client(this.config);
        //         await c.connect();
        //         const row = await c.query("SELECT pg_backend_pid() as id");
        //         c[pgID] = (row.rows as any).id;
        //         return c;
        //     },
        //     destroy(item) {
        //         return item.end();
        //     },
        //     subscribeForRemoval(po, clear) {
        //         po.on("end", clear);
        //         po.on("error", clear);
        //     },
        // });
    }

    insertQuery(type: EntityType, entity: any): { text: string; values: any[]; } {
        let fields = "";
        let valueParams = "";
        let returning = "";
        const values = [];
        let i = 1;
        const { quote } = this.compiler;
        for (const iterator of type.columns) {
            if (iterator.generated || iterator.computed) {
                if (returning) {
                    returning += ",\r\n\t\t";
                } else {
                    returning = "RETURNING ";
                }
                returning += iterator.quotedColumnName + " as " + iterator.quotedName;
                continue;
            }
            const value = entity[iterator.name];
            if (value === void 0) {
                continue;
            }
            if (fields) {
                fields += ",\r\n\t\t";
                valueParams += ",\r\n\t\t";
            }
            fields += iterator.quotedColumnName;
            valueParams += `$${i++}`;
            values.push(value);
        }
        const text = `INSERT INTO ${type.fullyQualifiedTableName}(${fields}) VALUES (${valueParams}) ${returning}`;
        return { text, values };
    }

    newConnection(): BaseConnection {
        return new PostgreSqlConnection(this);
    }
}

class PostgresTransaction extends EntityTransaction {

    constructor(conn: PostgreSqlConnection, private tx: PoolClient) {
        super(conn);
    }

    protected disposeTransaction() {
        (this.conn as any).transaction = null;
        return this.tx[Symbol.asyncDispose]();
    }
    protected commitTransaction() {
        return this.tx.query("COMMIT") as any;
    }
    protected rollbackTransaction() {
        return this.tx.query("ROLLBACK") as any;
    }
    protected beginTransaction() {
        return this.tx.query("BEGIN") as any;
    }

    protected saveTransaction(id: any) {
        return this.tx.query(`SAVEPOINT ${id}`) as any;
    }
    protected rollbackToTransaction(id: any) {
        return this.tx.query(`ROLLBACK TO ${id}`) as any;
    }

}

class PostgreSqlConnection extends BaseConnection {

    public get isInTransaction() {
        return this.transaction as any as boolean;
    }

    private transaction: PoolClient;

    private get config() {
        return this.connectionString;
    }

    constructor(driver: BaseDriver) {
        super(driver);
    }


    public automaticMigrations(context: EntityContext): Migrations {
        return new PostgresAutomaticMigrations(context);
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
                await connection[Symbol.asyncDispose]();
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

        const { config }  = this;
        const key = config.host + "//" + config.database + "/" + config.user;
        const pgPool = await namedPool.getOrCreateAsync(key,
            () => {
                const pool = new Pool(this.config);
                pool.on("error", (_error, _client) => {
                    // do nothing...
                });
                return Promise.resolve(pool);
            }, 15000, (x) => x.end().catch(console.warn));

        const client = await pgPool.connect();

        if (signal) {
            signal.addEventListener("abort", () => this.kill(client[pgID]).catch((error) => console.error(error)));
        }

        client[Symbol.asyncDispose] = () => client.release();

        return client;
    }

    protected async createDbTransaction(): Promise<EntityTransaction> {
        const tx = this.transaction = await this.getConnection();
        return new PostgresTransaction(this, tx);
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