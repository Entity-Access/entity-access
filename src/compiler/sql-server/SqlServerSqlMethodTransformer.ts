
import { prepare, prepareAny } from "../../query/ast/IStringTransformer.js";
import { ISqlHelpers, flattenHelpers } from "../ISqlHelpers.js";

export const SqlServerSqlHelper: ISqlHelpers = {
    in(a, array) {
        return prepareAny `${a} IN ${array}`;
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
    },
    date: {
        addDays(d, n) {
            return prepareAny `DateAdd(DAY, ${d}, ${n})`;
        },
        addHours(d, n) {
            return prepareAny `DateAdd(HOUR, ${d}, ${n})`;
        },
        addMinutes(d, n) {
            return prepareAny `DateAdd(MINUTE, ${d}, ${n})`;
        },
        addMonths(d, n) {
            return prepareAny `DateAdd(MONTH, ${d}, ${n})`;
        },
        addSeconds(d, n) {
            return prepareAny `DateAdd(SECOND, ${d}, ${n})`;
        },
        addYears(d, n) {
            return prepareAny `DateAdd(YEAR, ${d}, ${n})`;
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
        iLike(text, test) {
            return prepareAny `(${text} like ${test})`;
        },
        indexOf(text, test) {
            return prepareAny `CHARINDEX(${text}, ${test})`;
        },
        left(text, length) {
            return prepareAny `left(${text}, ${length})`;
        },
        like(text, test) {
            return prepareAny `(${text} LIKE ${test})`;
        },
        lower(text) {
            return prepareAny `LOWER(${text})`;
        },
        right(text, length) {
            return prepareAny `right(${text}, ${length})`;
        },
        startsWith(text, test) {
            return prepareAny `CHARINDEX(${text}, ${test}) = 1`;
        },

        upper(text) {
            return prepareAny `UPPER(${text})`;
        },

        normalize(text, kind = "NFC") {
            const sanitize = (t) => t.replace(/[\W_]+/g,"");
            return prepareAny `NORMALIZE(${text},${sanitize(kind)}`;

        },
    }
};

const names = flattenHelpers(SqlServerSqlHelper, "Sql");

export default function SqlServerSqlMethodTransformer(callee: string, args: any[]): string {
    const name = names[callee];
    if (!name) {
        return;
    }
    return names[callee]?.(... args);
}
