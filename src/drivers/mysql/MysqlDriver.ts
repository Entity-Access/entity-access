import TimedCache from "../../common/cache/TimedCache.js";
import { DisposableScope } from "../../common/usingAsync.js";
import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import MysqlAutomaticMigrations from "../../migrations/mysql/MysqlAutomaticMigrations.js";
import { BaseDriver, IDbConnectionString, IDbReader, IQuery, IQueryResult, disposableSymbol, toQuery } from "../base/BaseDriver.js";
import ExpressionToMysql from "./ExpressionToMySql.js";
import * as mysql from "mysql";

export type IMySqlConnectionString = mysql.ConnectionConfig | IDbConnectionString;

const timedCache = new TimedCache<string,mysql.Pool>();

export default class MysqlDriver extends BaseDriver {

    get compiler(): QueryCompiler {
        return this.mysqlCompiler ??= new QueryCompiler({
            expressionToSql: ExpressionToMysql
        });
    }

    private mysqlCompiler: QueryCompiler;

    constructor(connectionString: IMySqlConnectionString) {
        super(connectionString);
    }

    public async executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        throw new Error("Method not implemented.");
    }

    public async executeQuery(command: IQuery, signal?: AbortSignal): Promise<IQueryResult> {
        const disposables = new DisposableScope();
        try {
            const conn = await this.getConnection(signal);
            disposables.register(conn);
            command = toQuery(command);
            await conn.query({ sql: command.text, values: command.values });
        } finally {
            await disposables.dispose();
        }
    }
    public ensureDatabase(): Promise<any> {
        throw new Error("Method not implemented.");
    }
    public runInTransaction<T = any>(fx?: () => Promise<T>): Promise<T> {
        throw new Error("Method not implemented.");
    }
    public automaticMigrations(): Migrations {
        return new MysqlAutomaticMigrations(this.compiler);
    }

    private async getConnection() {
        const key = `${this.connectionString.host}:${this.connectionString.port}://${this.connectionString.user}/${this.connectionString.database}`;
        const pool = timedCache.getOrCreate(key, this,  () => mysql.createPool(this.connectionString));
        const conn = await new Promise<mysql.PoolConnection>((resolve, reject) => {
            pool.getConnection((e, c) => e ? reject(e) : resolve(c));
        });
        return new MysqlConnection(conn);
    }

}

class MysqlConnection {

    constructor(private conn: mysql.PoolConnection) {

    }

    prepare(command: IQuery) {
        const cmd = toQuery(command);
        const values = [];
        const sql = cmd.text.replace(/\$\d+/g, (s) => {
            const index = Number.parseInt(s.substring(1), 10);
            values.push(cmd.values[index]);
            return "?";
        });
        return { sql, values };
    }

    query(command: IQuery, signal?: AbortSignal) {
        signal?.throwIfAborted();
        signal?.addEventListener("abort", () => this.conn.destroy());
        return new Promise((resolve, reject) => {
            command = toQuery(command);
            command.text = command.text.replace(/\$\d+/g, "?");
            this.conn.query({
                sql: command.text,
                values: command.values
            }, (error, results, fields) => {
                if (error) {
                    reject(error);
                    return;
                }
            });
        });
    }

    [Symbol.disposable]() {
        this.conn.destroy();
    }
}