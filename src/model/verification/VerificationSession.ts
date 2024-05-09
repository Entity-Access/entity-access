import EntityAccessError from "../../common/EntityAccessError.js";
import Logger from "../../common/Logger.js";
import { TypeInfo } from "../../common/TypeInfo.js";
import { IColumn, IEntityRelation } from "../../decorators/IColumn.js";
import { ServiceProvider } from "../../di/di.js";
import { ConditionalExpression, ExistsExpression, Expression, NumberLiteral, ParameterExpression, SelectStatement, ValuesStatement } from "../../query/ast/Expressions.js";
import EntityContext from "../EntityContext.js";
import EntityQuery from "../EntityQuery.js";
import ChangeEntry from "../changes/ChangeEntry.js";
import EntityEvents, { ForeignKeyFilter } from "../events/EntityEvents.js";

type KeyValueArray = [string, any][];

const isKeyEmpty = (key: any, columnName: IColumn) => {
    switch(columnName.dataType) {
        case "BigInt":
        case "Int":
            return !key || key === 0 || key === "0";
    }
    return key === null || key === "";
};

export default class VerificationSession {

    private select: SelectStatement;

    private field: ConditionalExpression[];

    constructor(private context: EntityContext) {

        this.select = SelectStatement.create({});
    }

    queueVerification(change: ChangeEntry, events: EntityEvents<any>) {
        const { type, entity } = change;
        if (change.status !== "inserted") {
            // verify access to the entity
            const keys = [] as KeyValueArray;
            for (const iterator of type.keys) {
                const key = entity[iterator.name];
                if (key === void 0) {
                    break;
                }
                if (isKeyEmpty(key, iterator)) {
                    continue;
                }
                keys.push([iterator.columnName, key]);
            }
            if (keys.length === type.keys.length) {
                this.queueEntityKey(change, keys, events);
            }
        }

        if (change.status === "deleted") {
            return;
        }

        // for modified or inserted
        // we need to verify access to each foreign key

        for (const relation of type.relations) {
            if (relation.isInverseRelation) {
                continue;
            }

            const fk = relation.fkMap;
            if (!fk) {
                continue;
            }

            for (const { fkColumn , relatedKeyColumn } of fk) {

                const fkValue = entity[fkColumn.name];
                if (fkValue === void 0) {
                    // not set... ignore..
                    continue;
                }
                if (isKeyEmpty(fkValue, fkColumn)) {
                    continue;
                }

                // only if it is modified...
                if (change.status !== "inserted") {
                    if (!change.isModified(fkColumn.name)) {
                        continue;
                    }
                }
                this.queueEntityForeignKey(change, relation, fkColumn, relatedKeyColumn, fkValue);
            }
        }
    }
    queueEntityForeignKey(change: ChangeEntry, relation: IEntityRelation, fkColumn, relatedKeyColumn, value) {
        const relatedModel = relation.relatedEntity;
        const type = relation.relatedEntity.typeClass;
        const events = this.context.eventsFor(change.type.typeClass);
        const relatedEvents = this.context.eventsFor(relation.relatedEntity.typeClass);
        const context = this.context;
        const fk = new ForeignKeyFilter({
            context,
            events: relatedEvents,
            type: relatedModel,
            name: relation.name,
            fkName: fkColumn.name,
            entity: change.entity
        });
        let query = events.onForeignKeyFilter(fk);
        if (query === void 0) {
            query = fk.modify();
        }
        if (query === null) {
            return;
        }

        const eq = query as EntityQuery;
        const compare = Expression.equal(
            Expression.member(eq.selectStatement.sourceParameter, relatedKeyColumn.columnName),
            Expression.constant(value)
        );
        const typeName  = TypeInfo.nameOfType(type);
        this.addError(query as EntityQuery, compare , `Unable to access entity ${typeName} through foreign key ${TypeInfo.nameOfType(change.type)}.${relation.name}.\n`);
    }

    queueEntityKey(change: ChangeEntry, keys: KeyValueArray, events: EntityEvents<any>) {
        const type = change.type.typeClass;
        let query = this.context.query(type);
        query = change.status === "modified" ? events.modify(query) : events.delete(query);
        if (!query) {
            return;
        }
        let compare: Expression;
        const eq = query as EntityQuery;
        for (const [key, value] of keys) {
            const test = Expression.equal(
                Expression.member(eq.selectStatement.sourceParameter, Expression.identifier(key)),
                Expression.constant(value)
            );
            compare = compare
                ? Expression.logicalAnd(compare, test)
                : test;
        }
        const typeName = TypeInfo.nameOfType(type);
        this.addError(query  as EntityQuery, compare, `Unable to access entity ${typeName}.\n`);
    }

    async verifyAsync(): Promise<any> {
        if (!this.field?.length) {
            return;
        }
        this.select.fields =[
            Expression.as( this.field.length === 1 ? this.field[0] : Expression.templateLiteral(this.field), "error")
        ];
        this.select.sourceParameter = ParameterExpression.create({ name: "x"});
        const source = ValuesStatement.create({
            values: [
                [NumberLiteral.one]
            ],
            as: Expression.identifier("a"),
            fields: [Expression.identifier("a")]
        });
        this.select.source = source;
        const compiler = this.context.driver.compiler;
        const query = compiler.compileExpression(null, this.select);
        const logger = ServiceProvider.resolve(this.context, Logger);
        using session = logger.newSession();
        const { rows: [ { error }]} = await this.context.connection.executeQuery(query);
        if (error) {
            session.error(`Failed executing \n${query.text}\n[\n${query.values.join(",")}]\n${error?.stack ?? error}`);
            EntityAccessError.throw(error);
        }
    }

    addError(query: EntityQuery, compare: Expression, error: string) {
        const select = { ... query.selectStatement};
        select.fields = [
            NumberLiteral.one
        ];

        const where = select.where
            ? Expression.logicalAnd(select.where, compare)
            : compare;

        select.where = where;

        const text = ConditionalExpression.create({
            test: ExistsExpression.create({
                target: select
            }),
            consequent: Expression.constant(""),
            alternate: Expression.constant(error),
        });

        (this.field ??=[]).push(text);
    }
}
