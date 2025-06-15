import EntityAccessError from "../common/EntityAccessError.js";
import Logger from "../common/Logger.js";
import { modelSymbol } from "../common/symbols/symbols.js";
import { AsyncDisposableScope } from "../common/usingAsync.js";
import { IDbReader } from "../drivers/base/BaseDriver.js";
import EntityType from "../entity-query/EntityType.js";
import { BinaryExpression, CallExpression, DeleteStatement, ExistsExpression, Expression, ExpressionAs, Identifier, InsertStatement, JoinExpression, MemberExpression, NewObjectExpression, NumberLiteral, OrderByExpression, ParameterExpression, SelectStatement, TableLiteral, UpdateStatement } from "../query/ast/Expressions.js";
import { QueryExpander } from "../query/expander/QueryExpander.js";
import EntityContext from "./EntityContext.js";
import type { EntitySource } from "./EntitySource.js";
import { IOrderedEntityQuery, IEntityQuery } from "./IFilterWithParameter.js";
import RelationMapper from "./identity/RelationMapper.js";

export default class EntityQuery<T = any>
    implements IOrderedEntityQuery<T>, IEntityQuery<T> {

    public context: EntityContext;
    public type: EntityType;
    public selectStatement: SelectStatement;
    public signal?: AbortSignal;
    public traceQuery: (text: string) => void;
    public includes: any[];
    public scope: ParameterExpression[];
    constructor (p: Partial<EntityQuery<any>>
    ) {
        // lets clone select...
        Object.setPrototypeOf(p, EntityQuery.prototype);
        return p as EntityQuery;
    }

    select(p: any, fx: any): any {
        return this.map(p, fx);
    }

    insertInTo(es: EntitySource) {
        const model = es[modelSymbol] as EntityType;
        const table = model.fullyQualifiedName as TableLiteral;
        const fields = [] as string[];
        for (const iterator of this.selectStatement.fields) {
            if (iterator.type !== "ExpressionAs") {
                throw new EntityAccessError(`as Expression expected instead of ${iterator.type}`);
            }
            const expAs = iterator as ExpressionAs;
            const field = model.getField(expAs.alias.value);
            if (!field) {
                throw new EntityAccessError(`Field ${expAs.alias.value} not found in ${model.name}`);
            }
            fields.push(field.quotedColumnName);
        }
        const query = { ... this.selectStatement };
        const { driver } = this.context;
        const selectQuery = driver.compiler.compileExpression(null, query);
        const insertQuery = `INSERT INTO ${model.fullyQualifiedTableName}(${fields.join(",")})
        ${selectQuery.text}`;
        this.traceQuery?.(insertQuery);
        return this.context.connection.executeQuery({
            text: insertQuery,
            values: selectQuery.values
        }, this.signal);
    }

    selectView(parameters: any, fx: any): any {
        const exp = this.context.driver.compiler.compile(this, fx);
        const p1 = exp.params[0];
        if (p1) {
            p1.value = parameters;
        }
        const { selectStatement, type } = this;
        const fields = [] as Expression[];
        const modelFields = [] as Expression[];
        const { body } = exp;
        const sourceParameter = Expression.parameter("s", type);
        switch(body.type) {
            case "NewObjectExpression":
                const noe = body as NewObjectExpression;
                for (const iterator of noe.properties) {

                    const propertyName = iterator.alias.value;
                    const column = type.getField(propertyName);
                    if (column) {
                        fields.push(Expression.member(selectStatement.sourceParameter, column.quotedColumnNameExp));
                        modelFields.push(
                            Expression.member(
                            sourceParameter,
                            column.quotedColumnNameExp)
                        );
                        continue;
                    }

                    const { expression } = iterator;
                    fields.push(ExpressionAs.create({
                        expression,
                        alias: Expression.quotedIdentifier(iterator.alias.value)
                    }));
                    modelFields.push(Expression.as(
                            Expression.member(sourceParameter, Expression.quotedIdentifier(iterator.alias.value)),
                            Expression.quotedIdentifier(iterator.alias.value)
                        ));
                }
                break;
            default:
                fields.push(body);
                break;

        }
        const source = selectStatement;
        source.fields = fields;

        const newSelect = {
            ... selectStatement,
            source,
            fields: modelFields,
            joins: void 0,
            limit: selectStatement.limit,
            offset: selectStatement.offset,
            orderBy: void 0,
            where: void 0,
            preferLeftJoins: void 0,
            sourceParameter
        };
        delete (newSelect as any).debugView;
        delete source.limit;
        delete source.offset;
        return new EntityQuery({
            ... this,
            selectStatement: newSelect,
        });
    }

    map(parameters: any, fx: any): any {
        const q = this.extend(parameters, fx, (select, body) => {
            const fields = [] as Expression[];
            switch(body.type) {
                case "NewObjectExpression":
                    const noe = body as NewObjectExpression;
                    for (const iterator of noe.properties) {
                        fields.push(ExpressionAs.create({
                            expression: iterator.expression,
                            alias: Expression.quotedIdentifier(iterator.alias.value)
                        }));
                    }
                    break;
                default:
                    fields.push(body);
                    break;

            }
            return { ... select, fields };
        });
        q.type = null;
        return q;
    }

    withSignal(signal: AbortSignal): any {
        return new EntityQuery({ ... this, signal });
    }

    thenBy(parameters: any, fx: any): any {
        return this.orderBy(parameters, fx);
    }
    thenByDescending(parameters: any, fx: any) {
        return this.orderByDescending(parameters, fx);
    }

    where<P>(parameters: P, fx: (p: P) => (x: T) => boolean): any {

        return this.extend(parameters, fx, (select, body) => ({
            ... select,
            where: select.where ? Expression.logicalAnd(select.where, body): body
        }));
    }

    include(p: any): any {
        return new EntityQuery({
            ... this,
            includes: this.includes ? [ ... this.includes, p] : [p]
            // selectStatement
        });
    }

    union(p, fx): any {

        const limit = this.selectStatement.limit;
        const offset = this.selectStatement.offset;

        delete this.selectStatement.limit;
        delete this.selectStatement.offset;

        const p1 = Expression.parameter("p1", this.selectStatement.model);

        const where = this.where(p, fx) as this;

        return new EntityQuery({
            ... this,
            selectStatement: {
                ... p1.model.selectAllFields(),
                source: Expression.union( this.selectStatement, where.selectStatement),
                limit,
                offset
            },
        });
    }

    unionsAll(... p: any[]) {

        const limit = this.selectStatement.limit;
        const offset = this.selectStatement.offset;

        delete this.selectStatement.limit;
        delete this.selectStatement.offset;

        const p1 = Expression.parameter("p1", this.selectStatement.model);

        return new EntityQuery({
            ... this,
            selectStatement: {
                ... p1.model.selectAllFields(),
                source: Expression.unionAll( this.selectStatement, ... p.map((x) => x.selectStatement)),
                limit,
                offset
            },
        });
    }

    unions(... p: any[]) {

        const limit = this.selectStatement.limit;
        const offset = this.selectStatement.offset;

        delete this.selectStatement.limit;
        delete this.selectStatement.offset;

        const p1 = Expression.parameter("p1", this.selectStatement.model);

        return new EntityQuery({
            ... this,
            selectStatement: {
                ... p1.model.selectAllFields(),
                source: Expression.union( this.selectStatement, ... p.map((x) => x.selectStatement)),
                limit,
                offset
            },
        });
    }


    exists(p, fx): any {

        const pq = p as EntityQuery<any>;

        const { body } = this.context.driver.compiler.arrowToExpression.transform(
            fx,
            this.selectStatement.sourceParameter,
            pq.selectStatement.sourceParameter
        );

        let pqWhere = pq.selectStatement.where;
        pqWhere = pqWhere
            ? Expression.logicalAnd(pqWhere, body)
            : body;

        const exists = ExistsExpression.create({
            target: {
                ... pq.selectStatement,
                where: pqWhere
            } as SelectStatement,
        });

        let where = this.selectStatement.where;
        where = where
            ? Expression.logicalAnd(where, exists)
            : exists;

        const selectStatement = SelectStatement.create({
            ... this.selectStatement,
            where
        });

        return new EntityQuery({
            ... this,
            // scope: this.scope ? [ ... this.scope, as] : [as],
            selectStatement
        });
    }

    innerJoin(p, fx): any {

        const pq = p as EntityQuery<any>;

        const exp = this.context.driver.compiler.compile(this, fx);

        const as = exp.params[0];
        as.model = pq.selectStatement.model;

        const joins = this.selectStatement.joins ? [].concat(this.selectStatement.joins) : [];

        // we need to remove joins from pq and merge it here...

        let where = this.selectStatement.where;
        where = where
            ? Expression.logicalAnd(where, exp.body)
            : exp.body;

        joins.push(JoinExpression.create({
            forceJoinType: "INNER",
            source: pq.selectStatement,
            as,
            where: Expression.equal(NumberLiteral.one, NumberLiteral.one)
        }));

        return new EntityQuery({
            ... this, selectStatement: {
                ... this.selectStatement,
                joins,
                where
            }
        });
    }

    async delete(p, f): Promise<number> {
        if (f) {
            return this.where(p, f).delete(void 0, void 0);
        }

        const source = this.selectStatement;

        const sp = Expression.parameter("d1", this.type);
        const as = Expression.parameter("s1", this.type);
        let where: Expression;
        for (const iterator of this.type.keys) {
            const compare = Expression.equal(
                Expression.member(sp, iterator.quotedColumnNameExp),
                Expression.member(as, iterator.quotedColumnNameExp)
            );
            where = where ? Expression.logicalAnd(where, compare) : compare;
        }

        const join = JoinExpression.create({
            forceJoinType: "INNER",
            joinType: "INNER",
            source,
            as,
            where
        });

        const deleteQuery = DeleteStatement.create({
            table: this.type.fullyQualifiedName,
            sourceParameter: sp,
            join
        });

        const session = this.context.logger?.newSession() ?? Logger.nullLogger;
        let query;
        try {
            query = this.context.driver.compiler.compileExpression(this, deleteQuery);
            this.traceQuery?.(query.text);
            const r = await this.context.connection.executeQuery(query);
            return r.updated;
        } catch (error) {
            session.error(`Failed executing ${query?.text}\r\n${error.stack ?? error}`);
            throw error;
        }
    }

    async updateSelect(p?, f?): Promise<T[]> {
        const updateStatement = this.getUpdateStatement(p, f, true);

        await using scope = new AsyncDisposableScope();
        const session = this.context.logger ?? Logger.nullLogger;
        let query: { text: string, values: any[]};
        try {
            const type = this.type;
            const signal = this.signal;

            const relationMapper = new RelationMapper(this.context.changeSet);

            signal?.throwIfAborted();

            query = this.context.driver.compiler.compileExpression(this, updateStatement);
            this.traceQuery?.(query.text);
            const reader = await this.context.connection.executeReader(query, signal);
            scope.register(reader);
            const results = [] as T[];
            const prototype = type.typeClass.prototype;
            for await (const iterator of reader.next(10, signal)) {
                // const item = type.map(iterator) as any;
                // set identity...
                Object.setPrototypeOf(iterator, prototype);
                iterator.$type = type.entityName;
                const entry = this.context.changeSet.getEntry(iterator, iterator);
                relationMapper.fix(entry);
                results.push(entry.entity as any);
            }
            return results;
        } catch(error) {
            session.error(`Failed executing ${query?.text}\n${error.stack ?? error}`);
            throw error;
        }
    }

    async update(p?, f?): Promise<number> {

        const updateStatement = this.getUpdateStatement(p, f);

        const session = this.context.logger ?? Logger.nullLogger;
        let query;
        try {
            query = this.context.driver.compiler.compileExpression(this, updateStatement);
            this.traceQuery?.(query.text);
            const r = await this.context.connection.executeQuery(query);
            return r.updated;
        } catch (error) {
            session.error(`Failed executing ${query?.text}\r\n${error.stack ?? error}`);
            throw error;
        }
    }

    getUpdateStatement(p?, f?, returnEntity = false) {

        if (f) {
            return this.extend(p, f, (select, body) => {
                const fields = [] as Expression[];
                switch(body.type) {
                    case "NewObjectExpression":
                        const noe = body as NewObjectExpression;
                        for (const iterator of noe.properties) {
                            fields.push(ExpressionAs.create({
                                expression: iterator.expression,
                                alias: Expression.quotedIdentifier(iterator.alias.value)
                            }));
                        }
                        break;
                    default:
                        fields.push(body);
                        break;
                }
                return { ... select, fields };
            }).getUpdateStatement(p, void 0, returnEntity);
        }

        const as = Expression.parameter("s1", this.type);
        const sp = Expression.parameter("u1", this.type);
        const join = JoinExpression.create({
            forceJoinType: "INNER",
            joinType: "INNER",
            source: this.selectStatement,
            as
        });

        const set = [] as BinaryExpression[];

        const fieldMap = new Set();

        for (const iterator of this.selectStatement.fields) {
            if (iterator.type !== "ExpressionAs") {
                throw new Error(`Invalid expression ${iterator.type}`);
            }
            const eAs = iterator as ExpressionAs;
            const { field } = this.type.getProperty(eAs.alias.value);
            fieldMap.add(field.columnName);
            set.push(Expression.assign(field.quotedColumnNameExp, Expression.member(as, Expression.quotedIdentifier(eAs.alias.value))));
        }

        let where = null as Expression;
        for (const iterator of this.type.keys) {
            const compare = Expression.equal(
                Expression.member(as, iterator.quotedColumnNameExp),
                Expression.member(sp, iterator.quotedColumnNameExp)
            );
            where = where ? Expression.logicalAnd(where, compare) : compare;
            if (fieldMap.has(iterator.columnName)) {
                continue;
            }
            this.selectStatement.fields.push(Expression.member(this.selectStatement.sourceParameter, iterator.quotedColumnNameExp));
        }

        let returnUpdated = null as ExpressionAs[];
        if(returnEntity) {
            returnUpdated = [];
            for (const iterator of this.type.columns) {
                returnUpdated.push(Expression.as(
                    iterator.quotedColumnNameExp,
                    iterator.quotedNameExp
                ));
            }
        }

        const updateStatement = UpdateStatement.create({
            set,
            sourceParameter: sp,
            table: this.type.fullyQualifiedName,
            model: this.type,
            where,
            join,
            returnUpdated
        });
        return updateStatement;
    }

    async toArray(): Promise<T[]> {
        const results: T[] = [];
        for await (const iterator of this.enumerate()) {
            results.push(iterator);
        }
        return results;
    }

    async *enumerate(): AsyncGenerator<T, any, unknown> {

        await using scope = new AsyncDisposableScope();
        const session = this.context.logger?.newSession() ?? Logger.nullLogger;
        let query: { text: string, values: any[]};
        try {
            scope.register(session);
            const type = this.type;
            const signal = this.signal;

            const relationMapper = new RelationMapper(this.context.changeSet);

            const include = this.includes;
            if (include?.length > 0) {

                const selectForInclude = { ... this.selectStatement };

                this.context.driver.compiler.compileExpression(this, selectForInclude)

                // since we will be streaming results...
                // it is important that we load all the
                // included entities first...
                const loaders = include
                    .map((x) => QueryExpander.expand(this.context, selectForInclude , x, false)
                    .map((y) => this.load(relationMapper, session, y, signal)))
                    .flat(2);
                await Promise.all(loaders);
            }

            signal?.throwIfAborted();
            let select = this.selectStatement;

            if (type && select.model) {
                // we will filter the fields requested...
                const fields = [] as Expression[];
                for (const iterator of select.fields) {
                    switch(iterator.type) {
                        case "ExpressionAs":
                            fields.push(iterator);
                            continue;
                        case "MemberExpression":
                            const me = iterator as MemberExpression;
                            const column = type.getColumn((me.property as Identifier).value);
                            if (column) {
                                fields.push(Expression.as(
                                    Expression.member(select.sourceParameter, column.quotedColumnNameExp)
                                    , Expression.quotedIdentifier(column.name)));
                                continue;
                            }
                    }
                    fields.push(iterator);
                }
                select = { ... select, fields };
                // select = { ... select, fields: select.model.getFieldMap(select.sourceParameter) };
            }

            query = this.context.driver.compiler.compileExpression(this, select);
            this.traceQuery?.(query.text);
            const reader = await this.context.connection.executeReader(query, signal);
            scope.register(reader);
            const prototype = type?.typeClass.prototype;
            for await (const iterator of reader.next(10, signal)) {
                if (type) {
                    // const item = type.map(iterator) as any;
                    // set identity...
                    Object.setPrototypeOf(iterator, prototype);
                    iterator.$type = type.entityName;
                    const entry = this.context.changeSet.getEntry(iterator, iterator);
                    relationMapper.fix(entry);
                    yield entry.entity as any;
                    continue;
                }
                yield iterator as T;
            }

        } catch(error) {
            session.error(`Failed executing ${query?.text}\n${error.stack ?? error}`);
            throw error;
        }
    }

    async load(relationMapper: RelationMapper, session: Logger, select: SelectStatement, signal: AbortSignal) {
        let query: { text, values };
        let reader: IDbReader;
        try {
            if (select.model) {
                select = { ... select, fields: select.model.getFieldMap(select.sourceParameter) };
            }
            query = this.context.driver.compiler.compileExpression(this, select);
            this.traceQuery?.(query.text);
            reader = await this.context.connection.executeReader(query, signal);
            const type = select.model;
            const prototype = type?.typeClass.prototype;
            for await (const iterator of reader.next(10, signal)) {
                // const item = select.model?.map(iterator) ?? iterator;
                if (prototype) {
                    Object.setPrototypeOf(iterator, prototype);
                    iterator.$type = type.entityName;
                }
                const entry = this.context.changeSet.getEntry(iterator, iterator);
                relationMapper.fix(entry);
            }
        } catch (error) {
            session.error(`Failed loading ${query?.text}\n${error.stack ?? error}`);
            throw error;
        } finally {
            await reader?.dispose();
        }
    }

    async firstOrFail(errorMessage = `No records found for ${this.type?.name || "Table"}`): Promise<T> {
        const first = await this.first();
        if (first) {
            return first;
        }
        throw new Error(errorMessage);
    }

    async first(): Promise<T>{
        for await(const iterator of this.limit(1).enumerate()) {
            return iterator;
        }
        return null;
    }
    toQuery(): { text: string; values: any[]; } {
        return this.context.driver.compiler.compileExpression(this, this.selectStatement);
    }
    orderBy(parameters: any, fx: any): any {
        return this.extend(parameters, fx, (select, target) => ({
            ... select,
            orderBy: select.orderBy
                ? [ ... select.orderBy, OrderByExpression.create({ target})]
                : [OrderByExpression.create({ target})]
        }));
    }
    orderByDescending(parameters: any, fx: any): any {
        const descending = true;
        return this.extend(parameters, fx, (select, target) => ({
            ... select,
            orderBy: select.orderBy
                ? [ ... select.orderBy, OrderByExpression.create({ target, descending })]
                : [OrderByExpression.create({ target, descending })]
        }));
    }

    trace(traceQuery: (text: string) => void): any {

        if (traceQuery) {
            const old = traceQuery;
            const header = "\n====================================================================\n\n";
            const footer = "\n\n--------------------------------------------------------------------\n";
            traceQuery = (text: string) => {
                old(`${header}${text}${footer}`);
            };
        }

        return new EntityQuery({ ... this, traceQuery });
    }

    /**
     * Number of items to limit the result set. Applied only if not set or less than existing limit.
     * @param n max
     * @returns query
     */
    limit(n: number): any {
        const { selectStatement : { limit: currentLimit}} = this;
        if (currentLimit && currentLimit < n) {
            return this;
        }
        return new EntityQuery({ ... this, selectStatement: { ... this.selectStatement, limit: n} });
    }

    offset(n: number): any {
        return new EntityQuery({ ... this, selectStatement: { ... this.selectStatement, offset: n} });
    }

    async sum(parameters?:any, fx?: any): Promise<any> {
        if (fx !== void 0) {
            return this.map(parameters, fx).sum();
        }

        const fields = [];

        let fieldName;

        for (const field of this.selectStatement.fields) {
            let expression = field;
            if (field.type === "ExpressionAs") {
                const fe = field as ExpressionAs;
                expression = fe.expression;
                fieldName = fe.alias.value;
            } else {
                fieldName = "c1";
            }

            fields.push(ExpressionAs.create({
                expression: Expression.callExpression(
                    "COALESCE",
                    Expression.callExpression("SUM", expression),
                    NumberLiteral.zero),
                alias: Expression.quotedIdentifier(fieldName)
            }));
        }

        const select = { ... this.selectStatement, fields,
            orderBy: void 0
        };

        const nq = new EntityQuery({ ... this, selectStatement: select });

        await using scope = new AsyncDisposableScope();
        const session = this.context.logger ?? Logger.nullLogger;
        let query;
        try {
            query = this.context.driver.compiler.compileExpression(nq, select);
            this.traceQuery?.(query.text);
            const reader = await this.context.connection.executeReader(query);
            scope.register(reader);
            for await (const iterator of reader.next()) {
                if (fields.length > 1) {
                    return iterator as any;
                }
                return iterator.c1 as number;
            }
            // this is special case when database does not return any count
            // like sql server
            return 0;
        } catch (error) {
            session.error(`Failed executing ${query?.text}\r\n${error.stack ?? error}`);
            throw error;
        }

    }

    async some(): Promise<boolean> {
        // if (parameters !== void 0) {
        //     return this.where(parameters, fx).count();
        // }

        const select = { ... this.selectStatement, fields: [
            Expression.as(
                Identifier.create({ value: "1"}),
                "c1")
            ],
            orderBy: void 0
        };

        const nq = new EntityQuery({ ... this, selectStatement: select });

        await using scope = new AsyncDisposableScope();
        const session = this.context.logger ?? Logger.nullLogger;
        let query;
        try {
            query = this.context.driver.compiler.compileExpression(nq, select);
            this.traceQuery?.(query.text);
            const reader = await this.context.connection.executeReader(query);
            scope.register(reader);
            for await (const iterator of reader.next()) {
                if(iterator.c1 as number) {
                    return true;
                }
            }
            // this is special case when database does not return any count
            // like sql server
            return false;
        } catch (error) {
            session.error(`Failed executing ${query?.text}\r\n${error.stack ?? error}`);
            throw error;
        }

    }

    slice(start, end): any {
        const nq = new EntityQuery({
            ... this,
            selectStatement: {
                ... this.selectStatement,
                limit: end,
                offset: start
            }
        });
        return nq;
    }

    async count(parameters?:any, fx?: any): Promise<number> {
        if (parameters !== void 0) {
            return this.where(parameters, fx).count();
        }

        const select = { ... this.selectStatement, fields: [
            ExpressionAs.create({
                expression: CallExpression.create({
                    callee: Identifier.create({ value: "COUNT"}),
                    arguments: [ Identifier.create({ value: "*"})]
                }),
                alias: Expression.identifier("c1")
            })
            ],
            orderBy: void 0
        };

        const nq = new EntityQuery({ ... this, selectStatement: select });

        await using scope = new AsyncDisposableScope();
        const session = this.context.logger ?? Logger.nullLogger;
        let query;
        try {
            query = this.context.driver.compiler.compileExpression(nq, select);
            this.traceQuery?.(query.text);
            const reader = await this.context.connection.executeReader(query);
            scope.register(reader);
            for await (const iterator of reader.next()) {
                return iterator.c1 as number;
            }
            // this is special case when database does not return any count
            // like sql server
            return 0;
        } catch (error) {
            session.error(`Failed executing ${query?.text}\r\n${error.stack ?? error}`);
            throw error;
        }

    }

    private extend(parameters: any, fx: any, map: (select: SelectStatement, exp: Expression) => SelectStatement) {
        const exp = this.context.driver.compiler.compile(this, fx);
        const p1 = exp.params[0];
        if (p1) {
            p1.value = parameters;
        }
        return new EntityQuery({ ... this, selectStatement: map(this.selectStatement, exp.body)});
    }

}
