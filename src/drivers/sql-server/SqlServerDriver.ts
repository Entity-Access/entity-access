import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import { BaseDriver, IDbConnectionString, IDbReader, IQuery } from "../base/BaseDriver.js";
import * as sql from "mssql";
import SqlServerQueryCompiler from "./SqlServerQueryCompiler.js";
import SqlServerSqlMethodTransformer from "../../compiler/sql-server/SqlServerSqlMethodTransformer.js";
import SqlServerAutomaticMigrations from "../../migrations/sql-server/SqlServerAutomaticMigrations.js";
import { SqlServerLiteral } from "./SqlServerLiteral.js";
import usingAsync from "../../common/usingAsync.js";

export type ISqlServerConnectionString = sql.config;

export default class SqlServerDriver extends BaseDriver {
    get compiler(): QueryCompiler {
        return new SqlServerQueryCompiler();
    }

    constructor(private readonly config: ISqlServerConnectionString) {
        super({
            database: config.database,
            host: config.server,
            port: config.port,
            password: config.password,
            user: config.user
        });
    }

    public executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        throw new Error("Method not implemented.");
    }
    public executeNonQuery(command: IQuery, signal?: AbortSignal): Promise<any> {
        throw new Error("Method not implemented.");
    }
    public ensureDatabase() {
        const create = async () => {
            const defaultDb = "master";
            const db = this.config.database;
            this.config.database = defaultDb;
            const connection = await this.getConnection();
            // @ts-expect-error readonly
            this.config = { ... this.config };
            this.config.database = db;

            return usingAsync(connection, async () => {
                const createSql = `IF NOT EXISTS ( SELECT name FROM master.dbo.sysdatabases WHERE name = N${SqlServerLiteral.escapeLiteral(db)})
                CREATE DATABASE ${SqlServerLiteral.escapeLiteral(db)}`;

                await connection.query(createSql);
            });
        };
        const value = create();
        Object.defineProperty(this, "ensureDatabase", {
            value: () => value,
        });
        return value;
    }

    public runInTransaction<T = any>(fx?: () => Promise<T>): Promise<T> {
        throw new Error("Method not implemented.");
    }

    public automaticMigrations(): Migrations {
        return new SqlServerAutomaticMigrations();
    }

    protected async getConnection() {
        const client = await sql.connect(this.config);
        return client;
    }

}