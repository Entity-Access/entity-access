
import { prepareAny } from "../../query/ast/IStringTransformer.js";
import { NotSupportedError } from "../../query/parser/NotSupportedError.js";
import { ISqlHelpers, flattenHelpers } from "../ISqlHelpers.js";

const onlyAlphaNumeric = (x: string) => x.replace(/\W/g, "");

export const PostgreSqlHelper: ISqlHelpers = {
    in(a, array) {
        return prepareAny `${a} IN ${array}`;
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
    },
    date: {
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
            return prepareAny `DATE_PART(${d}, day)`;
        },
        hourOf(d) {
            return prepareAny `DATE_PART(${d}, hour)`;
        },
        minuteOf(d) {
            return prepareAny `DATE_PART(${d}, minute)`;
        },
        monthOf(d) {
            return prepareAny `DATE_PART(${d}, month)`;
        },
        secondOf(d) {
            return prepareAny `DATE_PART(${d}, second)`;
        },
        yearOf(d) {
            return prepareAny `DATE_PART(${d}, year)`;
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
        iLike(text, test) {
            return prepareAny `(${text} iLike ${test})`;
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
    }
};

const names = flattenHelpers(PostgreSqlHelper, "Sql");

export default function PostgreSqlMethodTransformer(callee: string, args: any[]): string {
    const name = names[callee];
    if (!name) {
        return;
    }
    return names[callee]?.(... args);
}
