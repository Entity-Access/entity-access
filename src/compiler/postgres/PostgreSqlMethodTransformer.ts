import { joinAny, joinMap, prepareAny } from "../../query/ast/IStringTransformer.js";
import { NotSupportedError } from "../../query/parser/NotSupportedError.js";
import Sql from "../../sql/Sql.js";
import { ISqlHelpers, flattenMethods } from "../ISqlHelpers.js";
import type QueryCompiler from "../QueryCompiler.js";

const onlyAlphaNumeric = (x: string) => x.replace(/\W/g, "");

export const PostgreSqlHelper: ISqlHelpers = {
    ... Sql,
    in(a, array: any) {
        return prepareAny `${a} IN (${(x)=> joinMap(",", x, array)  })`;
    },
    coll: {
        sum(a) {
            return prepareAny `SUM(${a})`;
        },
        count(a) {
            return prepareAny `COUNT(${a})`;
        },
        avg(a) {
            return prepareAny `AVG(${a})`;
        },
    },
    math: {
        min(...p) {
            return prepareAny `LEAST(${ joinAny(p) })`;
        },
        max(...p) {
            return prepareAny `GREATEST(${ joinAny(p) })`;
        },
    },
    cast: {
        asBigInt(a) {
            return prepareAny `(${a} ::bigint)`;
        },
        asDate(a) {
            return prepareAny `(${a} ::date)`;
        },
        asDateTime(a) {
            return prepareAny `(${a} ::timestamp)`;
        },
        asInteger(a) {
            return prepareAny `(${a} ::int)`;
        },
        asNumber(a) {
            return prepareAny `(${a} ::double)`;
        },
        asText(a) {
            return prepareAny `(${a} ::text)`;
        },
        asDecimal(a) {
            return prepareAny `(${a} ::decimal(18,2))`;
        },
        asBoolean(a) {
            return prepareAny `(${a} ::boolean)`;
        }
    },
    date: {
        now() {
            return prepareAny `NOW()`;
        },
        addDays(d, n) {
            return prepareAny `(${d} + (${n} * interval '1 day'))`;
        },
        addHours(d, n) {
            return prepareAny `(${d} + (${n} * interval '1 hour'))`;
        },
        addMinutes(d, n) {
            return prepareAny `(${d} + (${n} * interval '1 minute'))`;
        },
        addMonths(d, n) {
            return prepareAny `(${d} + (${n} * interval '1 month'))`;
        },
        addSeconds(d, n) {
            return prepareAny `(${d} + (${n} * interval '1 second'))`;
        },
        addYears(d, n) {
            return prepareAny `(${d} + (${n} * interval '1 year'))`;
        },
        dayOf(d) {
            return prepareAny `DATE_PART('day', ${d})`;
        },
        hourOf(d) {
            return prepareAny `DATE_PART('hour', ${d})`;
        },
        minuteOf(d) {
            return prepareAny `DATE_PART('minute', ${d})`;
        },
        monthOf(d) {
            return prepareAny `DATE_PART('month', ${d})`;
        },
        secondOf(d) {
            return prepareAny `DATE_PART('second', ${d})`;
        },
        yearOf(d) {
            return prepareAny `DATE_PART('year', ${d})`;
        },
        epoch(d) {
            return prepareAny `EXTRACT(EPOCH FROM ${d})`;
        },
    },
    text: {
        collate(text, collation) {
            return prepareAny `${text} COLLATE "${onlyAlphaNumeric(collation)}")`;
        },
        concat(...p) {
            const text = ["CONCAT("];
            let first = true;
            for (const iterator of p) {
                if (!first) {
                    text.push(",");
                }
                first = false;
                text.push(iterator);
            }
            text.push(")");
            return text as any;
        },
        concatImmutable(...p) {
            const text = ["("];
            let first = true;
            for (const iterator of p) {
                if (!first) {
                    text.push(" || ");
                }
                first = false;
                text.push(iterator);
            }
            text.push(")");
            return text as any;
        },
        concatWS(...fragments) {
            const text = ["CONCAT_WS("];
            let first = true;
            for (const iterator of fragments) {
                if (!first) {
                    text.push(",");
                }
                first = false;
                text.push(iterator);
            }
            text.push(")");
            return text as any;

        },
        difference(left, right) {
            throw new NotSupportedError("DIFFERENCE");
        },
        endsWith(text, test) {
            return prepareAny `strpos(${text}, ${test}) = length(${text}) - length(${test})`;
        },
        includes(text, test) {
            return prepareAny `(strpos(${text}, ${test}) > 0)`;
        },
        iLike(text, test) {
            return prepareAny `(${text} iLike ${test})`;
        },
        iLikeAny(text, test) {
            return ["(" , text , " iLIKE ANY (ARRAY[", (x)=> joinMap(",", x, test, (item) => [() => item] ), "]))"] as any;
        },
        indexOf(text, test) {
            return prepareAny `(strpos(${text}, ${test}) - 1)`;
        },
        left(text, length) {
            return prepareAny `left(${text}, ${length})`;
        },
        like(text, test) {
            return prepareAny `(${text} LIKE ${test})`;
        },
        likeAny(text, test) {
            return ["(" , text , " LIKE ANY (ARRAY[", (x)=> joinMap(",", x, test, (item) => [() => item] ), "]))"] as any;
        },
        lower(text) {
            return prepareAny `LOWER(${text})`;
        },
        right(text, length) {
            return prepareAny `right(${text}, ${length})`;
        },
        reverse(text) {
            return prepareAny `reverse(${text})`;
        },
        startsWith(text, test) {
            return prepareAny `starts_with(${text}, ${test})`;
        },
        substring(text, start, length) {
            if (length === void 0) {
                return prepareAny `SUBSTRING(${text}, ${start} + 1)`;
            }
            return prepareAny `SUBSTRING(${text}, ${start} + 1, ${length})`;
        },
        trim(text) {
            return prepareAny `TRIM(${text})`;
        },
        upper(text) {
            return prepareAny `UPPER(${text})`;
        },
        normalize(text, kind = "NFC") {
            return prepareAny `normalize(${text}, ${onlyAlphaNumeric(kind)})`;
        },
        isNullOrEmpty(text) {
            return prepareAny `(${text} IS NULL OR length(${text}) = 0)`;
        },
    }
};

export const PostgreSqlMethodTransformer = flattenMethods(PostgreSqlHelper);

// export default function PostgreSqlMethodTransformer(compiler: QueryCompiler, method: string, args: any[]): string {

//     let start = PostgreSqlHelper;
//     for (const iterator of callee) {
//         start = start[iterator];
//         if (!start) {
//             return;
//         }
//     }
//     if (!start) {
//         return;
//     }
//     // eslint-disable-next-line @typescript-eslint/ban-types
//     return (start as unknown as Function).apply(compiler, args);
// }
