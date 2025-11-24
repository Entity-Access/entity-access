
import { joinAny, joinMap, prepareAny } from "../../query/ast/IStringTransformer.js";
import Sql from "../../sql/Sql.js";
import { ISqlHelpers, flattenMethods } from "../ISqlHelpers.js";

export const SqlServerSqlHelper: ISqlHelpers = {
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
                return prepareAny `geography::Point(${x}, ${y}, 4326)`;
            }
            return prepareAny `geography::Point(${x}, ${y}, ${srid})`;
        },
        location(x: any) {
                return prepareAny `geography::Point(${[(p) => x[0](p).longitude]}, ${[(p) => x[0](p).latitude]}, 4326)`;
        },
        distance(x, y) {
            return prepareAny `${x}.STDistance(${y})`;
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
    cast: {
        asBigInt(a) {
            return prepareAny `CAST(${a} as bigint)`;
        },
        asDate(a) {
            return prepareAny `CAST(${a} as date)`;
        },
        asDateTime(a) {
            return prepareAny `CAST(${a} as datetime2)`;
        },
        asInteger(a) {
            return prepareAny `CAST(${a} as int)`;
        },
        asNumber(a) {
            return prepareAny `CAST(${a} as double)`;
        },
        asText(a) {
            return prepareAny `CAST(${a} as varchar(max))`;
        },
        asDecimal(a) {
            return prepareAny `CAST(${a} as decimal(18,2))`;
        },
        asBoolean(a) {
            return prepareAny `CAST(${a} as bit)`;
        }
    },
    crypto: {
        randomUUID() {
            return [`NEWID()`];
        },
    },
    date: {
        now() {
            return prepareAny `GETUTCDATE()`;
        },
        addDays(d, n) {
            return prepareAny `DateAdd(DAY, ${n}, ${d})`;
        },
        addHours(d, n) {
            return prepareAny `DateAdd(HOUR, ${n}, ${d})`;
        },
        addMinutes(d, n) {
            return prepareAny `DateAdd(MINUTE, ${n}, ${d})`;
        },
        addMonths(d, n) {
            return prepareAny `DateAdd(MONTH, ${n}, ${d})`;
        },
        addSeconds(d, n) {
            return prepareAny `DateAdd(SECOND, ${n}, ${d})`;
        },
        addYears(d, n) {
            return prepareAny `DateAdd(YEAR, ${n}, ${d})`;
        },
        dayOf(d) {
            return prepareAny `DATE_PART(day, ${d})`;
        },
        hourOf(d) {
            return prepareAny `DATE_PART(hour, ${d})`;
        },
        minuteOf(d) {
            return prepareAny `DATE_PART(minute, ${d})`;
        },
        monthOf(d) {
            return prepareAny `DATE_PART(month, ${d})`;
        },
        secondOf(d) {
            return prepareAny `DATE_PART(second, ${d})`;
        },
        yearOf(d) {
            return prepareAny `DATE_PART(year, ${d})`;
        },
        epoch(d) {
            return prepareAny `DATEDIFF(ss, '1970-01-01 00:00:00', ${d}))`;
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
    json: {
        isJson(text) {
            return prepareAny `(ISJSON(${text}) > 0)`;
        },
        isObject(text) {
            return prepareAny `(ISJSON(${text}, OBJECT) > 0)`;
        },
        isArray(text) {
            return prepareAny `(ISJSON(${text}, ARRAY) > 0)`;
        },
        isScalar(text) {
            return prepareAny `(ISJSON(${text}, SCALAR) > 0)`;
        },
        isNotJson(text) {
            return prepareAny `(ISJSON(${text}) = 0)`;
        },
        isNotObject(text) {
            return prepareAny `(ISJSON(${text}, OBJECT) = 0)`;
        },
        isNotArray(text) {
            return prepareAny `(ISJSON(${text}, ARRAY) = 0)`;
        },
        isNotScalar(text) {
            return prepareAny `(ISJSON(${text}, SCALAR) = 0)`;
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
            const sanitize = (t) => t.replace(/[\W_]+/g,"");
            return prepareAny `${text} COLLATE ` + sanitize(collation);
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
            return prepareAny `DIFFERENCE(${left}, ${right})`;
        },
        endsWith(text, test) {
            return prepareAny `CHARINDEX(${text}, ${test}) = LEN(${text}) - LEN(${test})`;
        },
        includes(text, test) {
            return prepareAny `(CHARINDEX(${test}, ${text}) > 0)`;
        },
        length(text) {
            return prepareAny `LEN(${text})`;
        },
        iLike(text, test) {
            return prepareAny `(${text} like ${test})`;
        },
        iLikeAny(text, test) {
            return ["(", (x)=> joinMap(" OR ", x, test, (item) => [ "(" , text, " like ", () => item , ")" ]), ")"] as any;
        },
        indexOf(text, test) {
            return prepareAny `(CHARINDEX(${test}, ${text}) - 1)`;
        },
        left(text, length) {
            return prepareAny `left(${text}, ${length})`;
        },
        like(text, test) {
            return prepareAny `(${text} LIKE ${test})`;
        },
        likeAny(text, test) {
            return ["(", (x)=> joinMap(" OR ", x, test, (item) => [ "(" , text, " iLike ", () => item , ")" ]), ")"] as any;
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
            return prepareAny `CHARINDEX(${text}, ${test}) = 1`;
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
            const sanitize = (t) => t.replace(/[\W_]+/g,"");
            return prepareAny `NORMALIZE(${text},${sanitize(kind)}`;

        },
        isNullOrEmpty(text) {
            return prepareAny `(${text} IS NULL OR DATALENGTH(${text}) = 0)`;
        },
    }
};

export const SqlServerSqlMethodTransformer = flattenMethods(SqlServerSqlHelper);

// export default function SqlServerSqlMethodTransformer(compiler: QueryCompiler, method: string, args: any[]): string {

//     let start = SqlServerSqlHelper;
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