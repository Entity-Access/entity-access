export type IQueryBuilderItem = string | ((p: any) => string);

export default class QueryBuilder {

    public static create() {
        return new QueryBuilder();
    }

    private items: IQueryBuilderItem[] = [];

    public appendJoin(separator: string = ",", ... p: (IQueryBuilderItem | QueryBuilder)[]) {
        let first = true;
        for (const iterator of p) {
            if (!first) {
                this.append(",");
            }
            first = false;
            this.append(iterator);
        }
        return this;
    }

    public append(item: IQueryBuilderItem | QueryBuilder) {
        const lastIndex = this.items.length - 1;
        const last = lastIndex > 0 ? this.items[lastIndex] : void 0;
        if (typeof last === "string" && typeof item === "string") {
            this.items[lastIndex] = last + item;
            return this;
        }
        if (item instanceof QueryBuilder) {
            for (const iterator of item.items) {
                this.append(iterator);
            }
            return this;
        }
        this.items.push(item);
        return this;
    }

    public combine(a: TemplateStringsArray, ... p: (IQueryBuilderItem | QueryBuilder)[]) {
        for (let index = 0; index < a.length; index++) {
            const element = a[index];
            this.append(element);
            if (index < p.length) {
                this.append(p[index]);
            }
        }
        return this;
    }

}
