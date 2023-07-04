
import { prepareAny } from "../../query/ast/IStringTransformer.js";
import { ISqlHelpers, flattenHelpers } from "../ISqlHelpers.js";

export const PostgreSqlHelper: ISqlHelpers = {
    in(a, array) {
        return prepareAny `${a} IN ${array}`;
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
        concat(...p) {
            return prepareAny `CONCAT(${p.join(",")})`;
        },
        endsWith(text, test) {
            return prepareAny `strpos(${text}, ${test}) = length(${text}) - length(${test})`;
        },
        iLike(text, test) {
            return prepareAny `(${text} iLike ${test})`;
        },
        indexOf(text, test) {
            return prepareAny `strpos(${text}, ${test})`;
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
            return prepareAny `starts_with(${text}, ${test})`;
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
