/**
 * When an expression is already filtered, we should assume that
 * Events author has taken care of filtering and does not require
 * nested filtering.
 */

export const filteredSymbol = Symbol("filtered");

const hasOwnProperty = Object.prototype.hasOwnProperty;

export const FilteredExpression = {
    isFiltered(fx): boolean {
        return fx[filteredSymbol];
    },
    markAsFiltered(fx) {
        if (!fx || typeof fx !== "object") {
            return fx;
        }
        if (fx[filteredSymbol]) {
            return fx;
        }
        fx[filteredSymbol] = true;
        for (const key in fx) {
            if (hasOwnProperty.call(fx, key)) {
                const element = fx[key];
                FilteredExpression.markAsFiltered(element);
            }
        }
        return fx;
    }
};
