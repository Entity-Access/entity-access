import { Expression } from "@babel/types";

export default class ReplaceParameter {

    public static replace(tree: Expression | Expression[], from: Expression, to: Expression) {
        if (!tree) {
            return tree;
        }
        if (tree === from) {
            return to;
        }
        if (Array.isArray(tree)) {
            const copy = [];
            let index = 0;
            for (const iterator of tree) {
                Object.defineProperty(copy, index++, {
                    value: this.replace(iterator, from, to),
                    writable: false,
                    enumerable: true
                });
            }
            return tree;
        }
        if (!(tree as any).type) {
            return tree;
        }
        const treeCopy = {};
        for (const key in tree) {
            if (Object.prototype.hasOwnProperty.call(tree, key)) {
                const element = tree[key];
                Object.defineProperty(treeCopy, key, {
                    value: this.replace(element, from, to)
                });
            }
        }
        Object.setPrototypeOf(treeCopy, Object.getPrototypeOf(tree));
        return treeCopy;
    }

}