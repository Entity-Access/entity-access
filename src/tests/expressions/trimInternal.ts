import assert, { AssertionError } from "assert";

export const trimInternal = (text: string) => {
    let r = "";
    for (const iterator of text) {
        switch(iterator) {
            case "\n":
            case "\t":
            case "\r":
            case " ":
                if (!r.endsWith(" ")) {
                    r += " ";
                }
                continue;
        }
        r += iterator;
    }
    return r.trim();
};

export const assertSqlMatch = (expected: string, actual: string) => {
    const expectedTrimmed = trimInternal(expected);
    const actualTrimmed = trimInternal(actual);
    assert.strictEqual(actualTrimmed, expectedTrimmed);
};
