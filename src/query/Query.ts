export const queryItem = Symbol("queryItem");

export class QueryPart {

    public static from(a: Partial<QueryPart>) {
        Object.setPrototypeOf(a, QueryPart.prototype);
        return a as QueryPart;
    }

    public name: string;
    public literal: boolean;
    public quoted: boolean;
    public value: any;

    public toString() {
        if (this.quoted) {
            return JSON.stringify(this.name);
        }
        return this.name;
    }

}

export type IQuery = string | QueryPart;

export class Query {

    public static empty = new Query([]);

    public static literal = (name): QueryPart => QueryPart.from({ name, literal: true });

    public static quotedLiteral = (... names: string []): QueryPart[] => names.map((name) => QueryPart.from({ name, literal: true, quoted: true }));

    public static join(queries: Query[], separator: string = ", ") {
        const r: IQuery[] = [];
        for (const iterator of queries) {
            if (r.length > 0) {
                r.push(separator);
            }
            r.push(... iterator.parts);
        }
        return new Query(r);
    }

    public static create(t: TemplateStringsArray, ... a: any[]) {
        const r: IQuery[] = [];

        let pi = 0;

        for (let index = 0; index < t.length; index++) {
            const element = t[index];
            r.push(element);
            let name: string;
            if (index < a.length) {
                let value = a[index] as any;
                if (value === void 0) {
                    continue;
                }
                if (Array.isArray(value)) {
                    for (const iterator of value) {
                        if (iterator instanceof QueryPart) {
                            if(iterator.literal) {
                                r.push(iterator);
                                continue;
                            }
                        }
                        name = "@p" + pi++;
                        r.push(QueryPart.from({ name, value }));
                    }
                    continue;
                }
                if (value !== null && typeof value === "object") {

                    if (value instanceof QueryPart) {
                        if (value.literal) {
                            r.push(value);
                            continue;
                        }
                    }

                    if (value instanceof Query) {
                        for (const iterator of value.parts) {
                            if (typeof iterator === "string") {
                                r.push(iterator);
                                continue;
                            }
                            if (iterator instanceof QueryPart) {
                                if (iterator.literal) {
                                    r.push(iterator);
                                    continue;
                                }
                            }
                            name = "@p" + pi++;
                            r.push(QueryPart.from({ name, value }));
                        }
                        continue;
                    }
                }
                name = "@p" + pi++;
                r.push(QueryPart.from({ name, value }));
            }
        }

        return new Query(r);
    }

    constructor(public readonly parts: IQuery[] = []) {

    }

    append(t: TemplateStringsArray, ... a: []) {
        return new Query(this.parts.concat(... Query.create(t, ... a).parts));
    }

    appendLiteral(text) {
        return new Query(this.parts.concat([Query.literal(text)]));
    }

    appendQuotedLiteral(text) {
        return new Query(this.parts.concat(Query.quotedLiteral(text)));
    }

    appendParameter(value, name?) {
        name ??= "@p" + Date.now();
        return new Query(this.parts.concat(QueryPart.from({ name, value })));
    }

    toString() {
        return this.parts.join("");
    }

    toQuery(
        naming: (name: string, index: number) => string = (name, i) => `$${i}`,
        quote: (name: string) => string = (name) => JSON.stringify(name)
    ) {
        let text = "";
        const values = [];
        for (const iterator of this.parts) {
            if (typeof iterator === "string") {
                text += iterator;
                continue;
            }
            if (iterator instanceof QueryPart) {
                if (iterator.literal) {
                    if (iterator.quoted) {
                        text += quote(iterator.name);
                        continue;
                    }
                    text += iterator.name;
                    continue;
                }
                text += naming(iterator.name, values.length + 1);
                values.push(iterator.value);
            }
        }
        return { text, values };
    }
}
