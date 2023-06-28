import { Query } from "../../query/Query.js";
import { BaseDriver, IDbConnectionString, IDbReader, IRecord } from "../base/BaseDriver.js";
import pkg from "pg";
import Cursor from "pg-cursor";

const { Client } = pkg;

export interface IPgSqlConnectionString extends IDbConnectionString {
    
    user?: string, // default process.env.PGUSER || process.env.USER
    password?: string, //default process.env.PGPASSWORD
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
            const rows = this.cursor.read(min);
            yield *rows;
            if (rows.length === 0) {
                break;
            }
        } while (true)
    }

    async dispose() {
        try {
            await this.cursor.close();
        } catch {

        }

        try {
            await this.client.close();
        } catch {

        }
    }
}

export default class PostgreSqlDriver extends BaseDriver {

    constructor(private readonly config: IPgSqlConnectionString) {
        super(config);
    }

    public escape(name: string) {
        return JSON.stringify(name);
    }

    public async executeReader(command: Query): Promise<IDbReader> {
        const connection = await this.getConnection();
        const q = command.toQuery();
        const cursor = connection.query(new Cursor(q.text, q.values));
        return new DbReader(cursor, connection);
    }

    public async executeNonQuery(command: Query) {
        const connection = await this.getConnection();
        // we need to change parameter styles
        try {
            await connection.query(command.toQuery());
        } finally {
            await connection.end();
        }
    }

    private async getConnection() {
        const client = new Client(this.config);
        await client.connect();
        return client;
    }
}