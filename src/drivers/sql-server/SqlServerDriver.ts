import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import { BaseDriver, IDbConnectionString, IDbReader, IQuery, toQuery } from "../base/BaseDriver.js";
import sql from "mssql";
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
            host: config.server ??= (config as any).host,
            port: config.port,
            password: config.password,
            user: config.user,
            ... config,
        });
    }

    public async executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        const client = await this.getConnection();
        command = toQuery(command);

        let rq = client.request();
        if (command) {
            let id = 0;
            for (const iterator of command.values) {
                const p = `@p${++id}`;
                command.text = command.text.replace(new RegExp("^\\$" + id + "$", "g"), p);
                rq = rq.input(p, iterator);
            }
        }
        rq.stream = true;

        const pending = [];
        let ended = false;
        let error = null;

        let processPendingRows = () => void 0;

        rq.on("row", (row) => {
            pending.push(row);
            processPendingRows();
        });

        rq.on("error", (e) => {
            error = e;
            processPendingRows();
        });

        rq.on("done", () => {
            ended = true;
            processPendingRows();
        });

        rq.query(command.text);

        return {
            async *next(min, s = signal) {
                do {
                    const { rows, done } = await new Promise<{ rows?: any[], done?: boolean}>((resolve, reject) => {

                        if (pending.length) {
                            resolve({ rows: [].concat(pending)});
                            pending.length = 0;
                            return;
                        }

                        if (error) {
                            reject(error);
                            return;
                        }

                        if (ended) {
                            resolve({ done: true });
                            return;
                        }

                        processPendingRows = () => {
                            if(pending.length) {
                                resolve({ rows: [].concat(pending)});
                                pending.length = 0;
                                return;
                            }
                            if(error) {
                                reject(error);
                                return;
                            }
                            if (ended) {
                                resolve({ done: true });
                                return;
                            }
                        };
                    });
                    if (rows) {
                        yield *rows;
                    }
                    if (done) {
                        break;
                    }
                }  while(true);
            },
            dispose() {
                return client.close();
            },
        };
    }
    public async executeNonQuery(command: IQuery, signal?: AbortSignal): Promise<any> {
        const client = await this.getConnection();
        return usingAsync(client, async () => {

            command = toQuery(command);

            let rq = client.request();
            if (command) {
                let id = 0;
                for (const iterator of command.values) {
                    const p = `@p${++id}`;
                    command.text = command.text.replace(new RegExp("^\\$" + id + "$", "g"), p);
                    rq = rq.input(p, iterator);
                }
            }

            try {
                const r = await rq.query(command.text);
                return r.rowsAffected;
            } catch (error) {
                throw new Error(`Failed executing ${command.text}\r\n${error.stack ?? error}`);
            }
        });
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
                const createSql = `IF NOT EXISTS (SELECT name FROM master.dbo.sysdatabases WHERE name = ${SqlServerLiteral.escapeLiteral(db)}) BEGIN
                    CREATE DATABASE ${db};
                END`;

                try {
                    await connection.query(createSql);
                } catch(error) {
                    throw new Error(`Failed executing: ${createSql}\r\n${error.stack ?? error}`);
                }
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