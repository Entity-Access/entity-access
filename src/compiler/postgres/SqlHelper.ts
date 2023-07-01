import { ISqlHelpers } from "../ISqlHelpers.js";

export const PostgreSqlHelper: ISqlHelpers = {
    in(a, array) {
        return `${a} IN ${array}`;
    },
    date: {
        addDays(d, n) {
            return `(${d} + (${n} * interval '1 day'))`;
        },
        addHours(d, n) {
            return `(${d} + (${n} * interval '1 hour'))`;
        },
        addMinutes(d, n) {
            return `(${d} + (${n} * interval '1 minute'))`;
        },
        addMonths(d, n) {
            return `(${d} + (${n} * interval '1 month'))`;
        },
        addSeconds(d, n) {
            return `(${d} + (${n} * interval '1 second'))`;
        },
        addYears(d, n) {
            return `(${d} + (${n} * interval '1 year'))`;
        },
        dayOf(d) {
            return `DATE_PART(${d}, day)`;
        },
        hourOf(d) {
            return `DATE_PART(${d}, hour)`;
        },
        minuteOf(d) {
            return `DATE_PART(${d}, minute)`;
        },
        monthOf(d) {
            return `DATE_PART(${d}, month)`;
        },
        secondOf(d) {
            return `DATE_PART(${d}, second)`;
        },
        yearOf(d) {
            return `DATE_PART(${d}, year)`;
        },
    },
    text: {
        concat(...p) {
            return `CONCAT(${p.join(",")})`;
        },
        endsWith(text, test) {
            return `strpos(${text}, ${test}) = length(${text}) - length(${test})`;
        },
        iLike(text, test) {
            return `(${text} iLike ${test})`;
        },
        indexOf(text, test) {
            return `strpos(${text}, ${test})`;
        },
        left(text, length) {
            return `left(${text}, ${length})`;
        },
        like(text, test) {
            return `(${text} LIKE ${test})`;
        },
        right(text, length) {
            return `right(${text}, ${length})`;
        },
        startsWith(text, test) {
            return `starts_with(${text}, ${test})`;
        },
    }
};
