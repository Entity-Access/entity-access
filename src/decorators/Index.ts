import ExpressionToSql from "../query/ast/ExpressionToSql.js";
import ArrowToExpression from "../query/parser/ArrowToExpression.js";
import { IClassOf } from "./IClassOf.js";
import IIndexDef, { IIndex, IIndexedColumn } from "./IIndex.js";
import SchemaRegistry from "./SchemaRegistry.js";
import NameParser from "./parser/NameParser.js";


export default function Index<T>(
    {
        name,
        columns: columnDefs,
        unique,
        include,
        indexType,
        filter
    }
    : IIndexDef<T>) {
    return function(target: IClassOf<T>) {
        const model = SchemaRegistry.model(target);
        const columns = [] as IIndexedColumn[];

        const i: IIndex = {
            name,
            unique,
            include,
            indexType,
            filter,
            columns
        };
        for (const iterator of columnDefs) {
            const def = typeof iterator === "function"
                ? { name: iterator, descending: false }
                : iterator;
            columns.push({
                name: NameParser.parseMember(def.name),
                descending: def.descending
            });
        }
        model.indexes.push(i);
    };
}