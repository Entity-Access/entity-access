import TimedCache from "../../common/cache/TimedCache.js";
import { DisposableScope } from "../../common/usingAsync.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import MysqlAutomaticMigrations from "../../migrations/mysql/MysqlAutomaticMigrations.js";
import { BaseDriver, IDbConnectionString, IDbReader, IQuery, IQueryResult, IRecord, disposableSymbol, toQuery } from "../base/BaseDriver.js";
import ExpressionToMysql from "./ExpressionToMySql.js";
import * as mysql from "mysql2/promise";
import { MySqlLiteral } from "./MySqlLiteral.js";

export type IMySqlConnectionString = mysql.ConnectionConfig | IDbConnectionString;

const timedCache = new TimedCache<string,mysql.Pool>();

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
            quotedLiteral: MySqlLiteral.quotedLiteral,
            escapeLiteral: MySqlLiteral.escapeLiteral,
        });
    }

    private mysqlCompiler: QueryCompiler;

    private transaction: MysqlConnection;

    constructor(connectionString: IMySqlConnectionString) {
        super(connectionString);
    }

    public async executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        return (await this.getConnection()).executeReader(command, signal);
    }

    public async executeQuery(command: IQuery, signal?: AbortSignal): Promise<IQueryResult> {
        const disposables = new DisposableScope();
        try {
            const conn = await this.getConnection();
            disposables.register(conn);
            return await conn.query(command, signal);
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
    public async runInTransaction<T = any>(fx?: () => Promise<T>): Promise<T> {
        const scope = new DisposableScope();
        try {
            const transaction = await this.getConnection();
            this.transaction = transaction;
            scope.register(await transaction.beginTransaction());
            return fx();
        } finally {
            await scope.dispose();
        }
    }
    public automaticMigrations(): Migrations {
        return new MysqlAutomaticMigrations(this.compiler);
    }

    private async getConnection() {
        if (this.transaction) {
            return this.transaction;
        }
        const key = `${this.connectionString.host}:${this.connectionString.port}://${this.connectionString.user}/${this.connectionString.database}`;
        const pool = timedCache.getOrCreate(key, this,  () => mysql.createPool(this.connectionString));
        return new MysqlConnection(await pool.getConnection());
    }

}

class MysqlTransaction {

    committed: boolean;

    constructor(private conn: mysql.PoolConnection) {}

    async commit() {
        this.committed = true;
        return this.conn.commit();
    }

    [Symbol.asyncDisposable]() {
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

    constructor(private conn: mysql.PoolConnection, private query: IQuery) {}

    async *next(min?: number, signal?: AbortSignal): AsyncGenerator<IRecord, any, any> {
        const query = this.conn;
        this.conn.query(prepare(this.query)).catch((error) => {
            this.error = error;
            this.processPendingRows();
        });
        this.processPendingRows = () => void 0;
        query.on("end", () => {
            this.ended = true;
            this.processPendingRows();
        });
        query.on("result", (row) => {
            this.pending.push(row);
            this.processPendingRows();
        });
        query.on("error", (error) => this.error = error);
        signal?.addEventListener("abort", () => {
            this.error = new Error("Aborted");
            this.conn.end().catch(() => void 0);
            this.processPendingRows();
        });
        do {
            if (this.pending.length > 0){
                const copy = this.pending;
                this.pending = [];
                yield *copy;
            }
            if (this.ended) {
                break;
            }
            if (this.error) {
                throw this.error;
            }
            await new Promise<any>((resolve, reject) => {
                this.processPendingRows = resolve;
            });
        } while (true);
    }
    dispose(): Promise<any> {
        this.conn.release();
        return Promise.resolve();
    }
    [disposableSymbol]?(): void {
        this.conn.release();
    }

}

class MysqlConnection {

    constructor(private conn: mysql.PoolConnection) {

    }

    executeReader(query: IQuery, signal?: AbortSignal): MysqlReader {
        return new MysqlReader(this.conn, query);
    }

    async beginTransaction() {
        await this.conn.beginTransaction();
        return new MysqlTransaction(this.conn);
    }

    async query(command: IQuery, signal?: AbortSignal): Promise<IQueryResult> {
        signal?.throwIfAborted();
        signal?.addEventListener("abort", () => this.conn.destroy());
        const [rows, fields] = await this.conn.query(prepare(command));
        if (Array.isArray(rows)) {
            return {
                rows,
                updated: 0
            };
        }
        return {
            updated: rows.affectedRows
        };
    }

    [Symbol.disposable]() {
        this.conn.destroy();
    }
}