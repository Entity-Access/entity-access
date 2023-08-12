import TimedCache from "../../common/cache/TimedCache.js";
import { DisposableScope } from "../../common/usingAsync.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import MysqlAutomaticMigrations from "../../migrations/mysql/MysqlAutomaticMigrations.js";
import { BaseConnection, BaseDriver, IBaseTransaction, IDbConnectionString, IDbReader, IQuery, IQueryResult, IRecord, disposableSymbol } from "../base/BaseDriver.js";
import ExpressionToMysql from "./ExpressionToMySql.js";
import * as mysql from "mysql2/promise";
import { MySqlLiteral } from "./MySqlLiteral.js";
import ObjectPool, { NamedObjectPool } from "../../common/ObjectPool.js";
import EntityAccessError from "../../common/EntityAccessError.js";

export type IMySqlConnectionString = mysql.ConnectionConfig | IDbConnectionString;

const timedCache = new TimedCache<string, ObjectPool<mysql.Connection>>();

export const toQuery = (text: IQuery): { text: string, values?: any[]} => typeof text === "string"
    ? { text, values: [] }
    : text;

const prepare = (command: IQuery) => {
    const cmd = toQuery(command);
    const values = [];
    const sql = cmd.text.replace(/\$\d+/g, (s) => {
        const index = Number.parseInt(s.substring(1), 10);
        values.push(cmd.values[index-1]);
        return "?";
    });
    return { sql, values };
};

export default class MysqlDriver extends BaseDriver {

    get compiler(): QueryCompiler {
        return this.mysqlCompiler ??= new QueryCompiler({
            expressionToSql: ExpressionToMysql,
            escapeLiteral: MySqlLiteral.escapeLiteral,
        });
    }

    private mysqlCompiler: QueryCompiler;

    constructor(connectionString: IMySqlConnectionString) {
        super(connectionString);
    }

    newConnection(): BaseConnection {
        return new MySqlConnection(this, this.connectionString);
    }
}

class MySqlConnection extends BaseConnection {

    private transaction: mysql.Connection;

    constructor(driver: BaseDriver, private config) {
        super(driver);
    }

    public async executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        const connection = await this.getConnection(signal);
        const q = toQuery(command);
        return new MysqlReader(connection, q, signal);
    }

    public async executeQuery(command: IQuery, signal?: AbortSignal): Promise<IQueryResult> {
        const disposables = new DisposableScope();
        const c = toQuery(command);
        try {
            const conn = await this.getConnection();
            disposables.register(conn);
            const [rows, fields] = await conn.query(c.text, c.values);
            if(Array.isArray(rows)) {
                return {
                    rows,
                    updated: 0
                };
            }
            return {
                updated: rows.affectedRows
            };
        } finally {
            await disposables.dispose();
        }
    }
    public ensureDatabase(): Promise<any> {
        const create = async () => {
            const defaultDb = "";
            const db = this.connectionString.database;
            this.connectionString.database = defaultDb;
            const connection = await this.getConnection();
            this.connectionString.database = db;
            const scope = new DisposableScope();
            scope.register(connection);
            try {
                await connection.query("CREATE DATABASE IF NOT EXISTS " + MySqlLiteral.quotedLiteral(db));
            } finally {
                await scope.dispose();
            }
        };
        const value = create();
        Object.defineProperty(this, "ensureDatabase", {
            value: () => value,
        });
        return value;

    }

    public async createTransaction(): Promise<IBaseTransaction> {
        if (this.transaction) {
            throw new EntityAccessError(`Transaction already in progress`);
        }
        const connection = await this.getConnection();
        await connection.beginTransaction();
        return new MysqlTransaction(connection);
    }

    public automaticMigrations(): Migrations {
        return new MysqlAutomaticMigrations(this.compiler);
    }

    private async getConnection(signal?: AbortSignal) {
        if (this.transaction) {
            return this.transaction;
        }
        const key = `${this.connectionString.host}:${this.connectionString.port}://${this.connectionString.user}/${this.connectionString.database}`;
        const pool = timedCache.getOrCreate(key, this.config, (config) => new ObjectPool<mysql.Connection>({
            asyncFactory: () => mysql.createConnection(config),
            destroy: (item) => {
                item.destroy();
            },
            subscribeForRemoval: (p, clear) => {
                p.on("error", clear );
            }
        }) );
        const c = await pool.acquire();
        if (signal) {
            signal.throwIfAborted();
            signal.onabort = () => c.destroy();
        }
        return c;
    }

}

class MysqlTransaction implements IBaseTransaction {

    committed: boolean;

    constructor(private conn: mysql.Connection) {}
    commit(): Promise<any> {
        this.committed = true;
        return this.conn.commit();
    }
    rollback(): Promise<any> {
        return this.conn.rollback();
    }
    dispose(): Promise<any> {
        if (!this.committed) {
            return this.conn.rollback();
        }
        return this.conn.commit();
    }
}

class MysqlReader implements IDbReader {

    private processPendingRows: (... a: any[]) => any;
    private ended: boolean;

    private error: any;

    private pending: any[] = [];

    constructor(private conn: mysql.Connection, private query: { text: string, values?: any[]}, private signal?: AbortSignal) {}

    async *next(min?: number, signal?: AbortSignal): AsyncGenerator<IRecord, any, any> {
        const [rows] = await this.conn.query(this.query.text, this.query.values) as any[][];
        yield *rows;
    }

    async dispose(): Promise<any> {
        if (this.conn) {
            await this.conn[Symbol.asyncDisposable];
        }
    }

}
