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

export type ISqlServerConnectionString = IDbConnectionString & sql.config;

const namedPool = new TimedCache<string, sql.ConnectionPool>();

sql.map.register(DateTime, sql.Date);
sql.map.register(DateTime, sql.DateTime);
sql.map.register(DateTime, sql.DateTime2);
sql.map.register(DateTime, sql.DateTimeOffset);
sql.map.register(DateTime, sql.SmallDateTime);

export default class SqlServerDriver extends BaseDriver {

    get compiler(): QueryCompiler {
        return this.sqlQueryCompiler;
    }

    private sqlQueryCompiler = new SqlServerQueryCompiler();

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

    dispose() {
        // do nothing
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

    getSchema(schema: string, table: string): Promise<IColumnSchema[]> {
        const text = `
            SELECT 
            COLUMN_NAME as [name],
            CASE DATA_TYPE
                WHEN 'bit' THEN 'Boolean'
                WHEN 'int' Then 'Int'
                WHEN 'bigint' THEN 'BigInt'
                WHEN 'date' then 'DateTime'
                WHEN 'datetime' then 'DateTime'
                WHEN 'datetime2' then 'DateTime'
                WHEN 'real' then 'Float'
                WHEN 'double' then 'Double'
                WHEN 'decimal' then 'Decimal'
                WHEN 'identity' then 'UUID'
                WHEN 'varbinary' then 'ByteArray'
                WHEN 'geometry' then 'Geometry'
                ELSE 'Char'
            END as [dataType],
            CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as [nullable],
            CHARACTER_MAXIMUM_LENGTH as [length]
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = $0
            AND TABLE_NAME = $1
        `;
        return this.executeQuery({ text, values: [schema, table] });
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
            console.error(error);
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

    public automaticMigrations(): Migrations {
        return new SqlServerAutomaticMigrations(this.sqlQueryCompiler);
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

class SqlReader implements IDbReader {

    private pending: any[] = [];
    private error: any = null;
    private count: number = 0;
    private ended = false;
    private processPendingRows: (... a: any[]) => any;

    constructor(
        private rq: sql.Request,
        private command: { text: string, values?: any[]}) {}

    async *next(min?: number, s?: AbortSignal) {
        const command = this.command;
        const rq = this.rq;
        s?.addEventListener("abort", () => {
            rq.cancel();
        });

        rq.stream = true;

        rq.on("row", (row) => {
            this.pending.push(row);
            this.count++;
            this.processPendingRows();
        });

        rq.on("error", (e) => {
            this.error = new Error(`Failed executing ${command.text}\r\n${e.stack ?? e}`);
            this.processPendingRows();
        });

        rq.on("done", () => {
            this.ended = true;
            this.processPendingRows();
        });

        void rq.query((command as any).text);

        do {
            if (this.error) {
                throw this.error;
            }
            if (this.pending.length > 0){
                const copy = this.pending;
                this.pending = [];
                yield *copy;
            }
            if (this.ended) {
                break;
            }
            await new Promise<any>((resolve, reject) => {
                this.processPendingRows = resolve;
            });
        }  while(true);
    }
    dispose(): Promise<any> {
        // if (!this.ended) {
        //     this.rq.cancel();
        // }
        return Promise.resolve();
    }
    [Symbol.asyncDispose]() {
        return this.dispose()?.catch((error) => console.error(error));
    }

}