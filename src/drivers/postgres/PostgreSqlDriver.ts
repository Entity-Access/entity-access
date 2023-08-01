/* eslint-disable no-console */
import TimedCache from "../../common/cache/TimedCache.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import { IColumn } from "../../decorators/IColumn.js";
import EntityType from "../../entity-query/EntityType.js";
import Migrations from "../../migrations/Migrations.js";
import PostgresAutomaticMigrations from "../../migrations/postgres/PostgresAutomaticMigrations.js";
import { Query } from "../../query/Query.js";
import { BaseDriver, IDbConnectionString, IDbReader, IQuery, IRecord, toQuery } from "../base/BaseDriver.js";
import { PoolClient } from "pg";
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

class DbReader implements IDbReader {

    constructor(private cursor, private client) {

    }

    async *next(min = 100) {
        do {
            const rows = await this.cursor.read(min);
            yield *rows;
            if (rows.length === 0) {
                break;
            }
        } while (true);
    }

    async dispose() {
        try {
            await this.cursor.close();
        } catch {
            // intentionally left blank
        }

        try {
            if (this.client) {
                await this.client.end();
            }
        } catch {
            // intentionally left blank
        }
    }
}

const poolCache = new TimedCache<string, pg.Pool>();

export default class PostgreSqlDriver extends BaseDriver {

    public get compiler() {
        return this.myCompiler;
    }

    private transaction: PoolClient;
    private myCompiler = new QueryCompiler();

    constructor(private readonly config: IPgSqlConnectionString) {
        super(config);
    }

    public async runInTransaction<T>(fx?: () => Promise<T>): Promise<T> {
        const connection = await this.getConnection();
        let result: T;
        try {
            this.transaction = connection;
            await connection.query("BEGIN");
            result = await fx();
            await connection.query("COMMIT");
            return result;
        } catch (error) {
            await connection.query("ROLLBACK");
            throw error;
        } finally {
            this.transaction = void 0;
            connection.release();
        }
    }

    public automaticMigrations(): Migrations {
        return new PostgresAutomaticMigrations(this.compiler);
    }

    public async executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        const connection = await this.getConnection(signal);
        const q = toQuery(command);
        const cursor = connection.query(new Cursor(q.text, q.values));
        return new DbReader(cursor, this.transaction ? void 0 : connection);
    }

    public async executeQuery(command: IQuery, signal?: AbortSignal) {
        const connection = await this.getConnection(signal);
        // we need to change parameter styles
        try {
            const q = toQuery(command);
            const result = await connection.query(q.text, q.values);
            return result;
        } finally {
            if (!this.transaction) {
                connection.release();
            }
        }
    }

    public ensureDatabase() {
        const create = async () => {
            const defaultDb = "postgres";
            const db = this.config.database;
            this.config.database = defaultDb;
            const connection = await this.getConnection();
            // @ts-expect-error readonly
            this.config = { ... this.config };
            this.config.database = db;
            try {
                const r = await connection.query("SELECT FROM pg_database WHERE datname = $1", [ db ]);
                if(r.rowCount === 1) {
                    return;
                }
                await connection.query("CREATE DATABASE " + JSON.stringify(db));
            } finally {
                connection.release();
            }
        };
        const value = create();
        Object.defineProperty(this, "ensureDatabase", {
            value: () => value,
        });
        return value;
    }


    private async getConnection(signal?: AbortSignal) {

        if (signal?.aborted) {
            throw new Error("Aborted");
        }

        if (this.transaction) {
            return this.transaction;
        }

        const key = `${this.config.host}:${this.config.port}//${this.config.database}?${this.config.user}&${this.config.password}`;

        const pooledClient = poolCache.getOrCreate(key, 1, () => new pg.Pool(this.config));
        const client = await pooledClient.connect();

        // const client = new Client(this.config);
        // await client.connect();
        const row = await client.query("SELECT pg_backend_pid() as id");
        const clientId = (row.rows as any).id;
        // there is no support to kill the query running inside
        if (signal) {
            signal.addEventListener("abort", () => this.kill(clientId).catch((error) => console.error(error)));
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