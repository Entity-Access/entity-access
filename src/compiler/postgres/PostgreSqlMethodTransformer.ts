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
        min(a) {
            return prepareAny `MIN(${a})`;
        },
        max(a) {
            return prepareAny `MAX(${a})`;
        },
    },

    spatial: {
        point(x, y, srid) {
            if (srid === void 0) {
                return prepareAny `ST_Point(${x}, ${y}, 4326)`;
            }
            return prepareAny `ST_Point(${x}, ${y}, ${srid})`;
        },
        location(x: any) {
                return prepareAny `ST_Point(${[(p) => x[0](p).longitude]}, ${[(p) => x[0](p).longitude]}, 4326)`;
        },
        distance(x, y) {
            return prepareAny `ST_Distance(${x}, ${y})`;
        },
    },

    window: {
        rank: {
            orderBy(order) {
                return prepareAny `RANK() OVER (ORDER BY ${order})`;
            },
            orderByDescending(order) {
                return prepareAny `RANK() OVER (ORDER BY ${order} DESC)`;
            },
            partitionByOrderBy(partition, order) {
                return prepareAny `RANK() OVER (PARTITION BY ${partition} ORDER BY ${order})`;
            },
            partitionByOrderByDescending(partition, order) {
                return prepareAny `RANK() OVER (PARTITION BY ${partition} ORDER BY ${order} DESC)`;
            },
        },
        denseRank: {
            orderBy(order) {
                return prepareAny `DENSE_RANK() OVER (ORDER BY ${order})`;
            },
            orderByDescending(order) {
                return prepareAny `DENSE_RANK() OVER (ORDER BY ${order} DESC)`;
            },
            partitionByOrderBy(partition, order) {
                return prepareAny `DENSE_RANK() OVER (PARTITION BY ${partition} ORDER BY ${order})`;
            },
            partitionByOrderByDescending(partition, order) {
                return prepareAny `DENSE_RANK() OVER (PARTITION BY ${partition} ORDER BY ${order} DESC)`;
            },
        },
        rowNumber: {
            orderBy(order) {
                return prepareAny `ROW_NUMBER() OVER (ORDER BY ${order})`;
            },
            orderByDescending(order) {
                return prepareAny `ROW_NUMBER() OVER (ORDER BY ${order} DESC)`;
            },
            partitionByOrderBy(partition, order) {
                return prepareAny `ROW_NUMBER() OVER (PARTITION BY ${partition} ORDER BY ${order})`;
            },
            partitionByOrderByDescending(partition, order) {
                return prepareAny `ROW_NUMBER() OVER (PARTITION BY ${partition} ORDER BY ${order} DESC)`;
            },
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
            return prepareAny `(${a} ::numeric)`;
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
    crypto: {
        randomUUID() {
            return [`gen_random_uuid()`];
        },
    },
    date: {
        now() {
            return prepareAny `NOW()`;
        },

        age(dob) {
            return prepareAny `EXTRACT (YEAR FROM AGE(${dob}))`;
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
    json: {
        isJson(text) {
            return prepareAny `${text} IS JSON`;
        },
        isObject(text) {
            return prepareAny `${text} IS JSON OBJECT`;
        },
        isArray(text) {
            return prepareAny `${text} IS JSON ARRAY`;
        },
        isScalar(text) {
            return prepareAny `${text} IS JSON SCALAR`;
        },
        isNotJson(text) {
            return prepareAny `${text} IS NOT JSON`;
        },
        isNotObject(text) {
            return prepareAny `${text} IS NOT JSON OBJECT`;
        },
        isNotArray(text) {
            return prepareAny `${text} IS NOT JSON ARRAY`;
        },
        isNotScalar(text) {
            return prepareAny `${text} IS NOT JSON SCALAR`;
        },
    },
    regex: {
        like(text, pattern, flags) {
            if (flags === void 0) {
                return prepareAny `RegExp_Like(${text}, ${pattern})`;
            }
            return prepareAny `RegExp_Like(${text}, ${pattern}, ${flags})`;
        },
        replace(text, pattern, startOrFlags, flags?) {
            if (flags === void 0) {
                return prepareAny `RegExp_Replace(${text}, ${pattern}, ${startOrFlags})` as any;
            }
            return prepareAny `RegExp_Replace(${text}, ${pattern}, ${startOrFlags} + 1, ${flags})` as any;
        }
    },
    text: {
        collate(text, collation) {
            return prepareAny `${text} COLLATE "${onlyAlphaNumeric(collation)}"`;
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
            return prepareAny `(strpos(${text}, ${test}) - 1 = (length(${text}) - length(${test})))`;
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
        length(text) {
            return prepareAny `char_length(${text})`;
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
