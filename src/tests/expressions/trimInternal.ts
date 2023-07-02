import { AssertionError } from "assert";

export const trimInternal = (text: string) => {
    let r = "";
    for (const iterator of text) {
        switch(iterator) {
            case "\n":
            case "\t":
            case "\r":
            case " ":
                continue;
        }
        r += iterator;
    }
    return r;
};

export const assertSqlMatch = (expected: string, actual: string) => {
    if (trimInternal(expected) === trimInternal(actual)) {
        return;
    }
    throw new AssertionError({ expected, actual, operator: "===" });
};
