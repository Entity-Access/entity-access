
import { prepareAny } from "../../query/ast/IStringTransformer.js";
import { ISqlHelpers, flattenHelpers } from "../ISqlHelpers.js";

export const SqlServerSqlHelper: ISqlHelpers = {
    in(a, array) {
        return prepareAny `${a} IN ${array}`;
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
        concat(...p) {
            return prepareAny `CONCAT(${p.join(",")})`;
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
        right(text, length) {
            return prepareAny `right(${text}, ${length})`;
        },
        startsWith(text, test) {
            return prepareAny `CHARINDEX(${text}, ${test}) = 1`;
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
