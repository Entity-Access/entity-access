/* eslint-disable no-console */
import QueryCompiler from "../../compiler/QueryCompiler.js";
import Migrations from "../../migrations/Migrations.js";
import { BaseConnection, BaseDriver, EntityTransaction, IDbConnectionString, IDbReader, IQuery, toQuery } from "../base/BaseDriver.js";
import sql from "mssql";
import SqlServerQueryCompiler from "./SqlServerQueryCompiler.js";
import SqlServerAutomaticMigrations from "../../migrations/sql-server/SqlServerAutomaticMigrations.js";
import { SqlServerLiteral } from "./SqlServerLiteral.js";
import TimedCache from "../../common/cache/TimedCache.js";
import EntityType from "../../entity-query/EntityType.js";
import DateTime from "../../types/DateTime.js";
import IColumnSchema from "../../common/IColumnSchema.js";
import type EntityContext from "../../model/EntityContext.js";
import ExistingSchema from "../base/ExistingSchema.js";
import ReaderQueue from "../base/ReaderQueue.js";
import EALogger from "../../common/EALogger.js";

export type ISqlServerConnectionString = IDbConnectionString & sql.config;

const namedPool = new TimedCache<string, sql.ConnectionPool>();

sql.map.register(DateTime, sql.Date);
sql.map.register(DateTime, sql.DateTime);
sql.map.register(DateTime, sql.DateTime2);
sql.map.register(DateTime, sql.DateTimeOffset);
sql.map.register(DateTime, sql.SmallDateTime);

const sqlQueryCompiler = new SqlServerQueryCompiler();

export default class SqlServerDriver extends BaseDriver {

    get compiler(): QueryCompiler {
        Object.defineProperty(this, "compiler", { value: sqlQueryCompiler, configurable: true });
        return sqlQueryCompiler;
    }

    constructor(private readonly config: ISqlServerConnectionString) {
        super(config);
        config.server = config.host;
    }

    insertQuery(type: EntityType, entity: any): { text: string; values: any[]; } {
        let fields = "";
        let valueParams = "";
        const values = [];
        let returning = "";
        let i = 1;
        const { quote } = this.compiler;
        for (const iterator of type.columns) {
            if (iterator.generated || iterator.computed) {
                if (returning) {
                    returning += ",\r\n\t\t";
                } else {
                    returning = "OUTPUT ";
                }
                returning += "INSERTED." + iterator.quotedColumnName + " as " + iterator.quotedName;
                continue;
            }
            const value = entity[iterator.name];
            if (value === void 0) {
                continue;
            }
            values.push(value);
            if (fields) {
                fields += ",\r\n\t\t";
                valueParams += ",\r\n\t\t";
            }
            fields += iterator.quotedColumnName;
            valueParams += `$${i++}`;
        }
        const text = `INSERT INTO ${type.fullyQualifiedTableName}(${fields}) ${returning} VALUES (${valueParams})`;
        return { text, values };
    }

    newConnection(): BaseConnection {
        return new SqlServerConnection(this, this.config);
    }
}

const emptyResolve = Promise.resolve();

class SqlEntityTransaction extends EntityTransaction {

    rolledBack: any;

    constructor(conn: SqlServerConnection, private tx: sql.Transaction) {
        super(conn);
        tx.on("rollback", (aborted) => {
            this.rolledBack = aborted;
        });
    }

    protected saveTransaction(id: any) {
        return this.tx.request().query(`SAVE TRANSACTION ${id}`) as any;
    }
    protected rollbackToTransaction(id: any): Promise<void> {
        return this.tx.request().query(`ROLLBACK TRANSACTION ${id}`) as any;
    }

    protected async beginTransaction() {
        this.tx = await this.tx.begin();
    }

    protected disposeTransaction(): Promise<void> {
        (this.conn as any).transaction = null;
        return emptyResolve;
    }
    protected async commitTransaction() {
        return this.tx.commit();
    }
    protected async rollbackTransaction() {
        if(this.rolledBack) {
            return;
        }
        await this.tx.rollback();
    }

}

export class SqlServerConnection extends BaseConnection {

    private transaction: sql.Transaction;

    private get sqlQueryCompiler() {
        return this.compiler as SqlServerQueryCompiler;
    }

    constructor(driver, private config: ISqlServerConnectionString) {
        super(driver);
    }

    public async executeReader(command: IQuery, signal?: AbortSignal): Promise<IDbReader> {
        command = toQuery(command);
        let rq = await this.newRequest(signal);

        if (command) {
            let id = 1;
            for (const iterator of command.values) {
                command.text = command.text.replace(/\$/, "@p");
                rq = rq.input("p" + id++, iterator);
            }
        }

        return new SqlReader(rq, command);
    }
    public async executeQuery(command: IQuery, signal?: AbortSignal): Promise<any> {
        let rq = await this.newRequest(signal);
        command = toQuery(command);

        if (command) {
            let id = 1;
            for (const iterator of command.values) {
                command.text = command.text.replace(/\$/, "@p");
                rq = rq.input(`p${id++}`, iterator);
            }
        }

        try {
            const r = await rq.query(command.text);
            const rows = r.recordset ?? [r.output];
            if (rows.length === 0) {
                // do something..
                const { recordsets } = r as any;
                for (let index = 0; index < recordsets.length; index++) {
                    const element = r.recordsets[index];
                    rows.push(...element);
                }
            }
            return { rows, updated: r.rowsAffected [0]};
        } catch (error) {
            error = `Failed executing query ${command.text}\r\n${error.stack ?? error}`;
            EALogger.error(error);
            throw new Error(error);
        }
    }

    public ensureDatabase() {
        const create = async () => {
            const config = { ... this.config, database: "master" };
            const db = this.config.database;

            const connection = await this.newConnection(config);

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

    public automaticMigrations(context: EntityContext): Migrations {
        return new SqlServerAutomaticMigrations(context);
    }

    protected async createDbTransaction(): Promise<EntityTransaction> {
        const tx = this.transaction = new sql.Transaction(await this.newConnection());
        return new SqlEntityTransaction(this, tx);
    }

    protected async newRequest(signal: AbortSignal) {
        let request: sql.Request;
        if (this.transaction) {
            request = this.transaction.request();
        } else {
            request = (await this.newConnection()).request();
        }
        // request.verbose = true;
        if (signal) {
            if (signal.aborted) {
                request.cancel();
                signal.throwIfAborted();
            }
            signal.onabort = () => request.cancel();
        }
        return request;
    }

    private newConnection(config = this.config) {
        const key = config.server + "//" + config.database + "/" + config.user;
        return namedPool.getOrCreateAsync(config.server + "://" + config.database,
            () => {
                const pool = new sql.ConnectionPool(config);
                const oldClose = pool.close;
                pool.close = ((c) => {
                    namedPool.delete(key);
                    return oldClose.call(pool, c);
                }) as any;
                return pool.connect();
            }, 15000, (x) => x.close());

    }

}

class SqlReader extends ReaderQueue implements IDbReader {

    constructor(
        private rq: sql.Request,
        private command: { text: string, values?: any[]}) {
        super();
    }

    begin(s?: AbortSignal) {
        const command = this.command;
        const rq = this.rq;
        s?.addEventListener("abort", () => {
            rq.cancel();
        });

        rq.stream = true;

        rq.on("row", (row) => {
            this.addItems([row]);
        });

        rq.on("error", (e) => {
            this.failed(new Error(`Failed executing ${command.text}\r\n${e.stack ?? e}`));
        });

        rq.on("done", () => {
            this.end();
        });

        void rq.query((command as any).text);
    }
    dispose(): Promise<any> {
        return this.drain();
    }
    [Symbol.asyncDispose]() {
        return this.dispose()?.catch((error) => EALogger.error(error));
    }

}