import { Expression } from "./Expressions.js";

export default class ReplaceParameter {

    public static replace<T>(tree: T, from: Expression, to: Expression): T;
    public static replace<T>(tree: T[], from: Expression, to: Expression): T[];
    public static replace<T>(tree: T | T[], from: Expression, to: Expression) {
        if (!tree) {
            return tree;
        }
        if (tree === from) {
            return to;
        }
        if (Array.isArray(tree)) {
            const copy = [];
            for (const iterator of tree) {
                if (iterator && typeof iterator === "object") {
                    copy.push(this.replace(iterator, from, to));
                    continue;
                }
                copy.push(iterator);
            }
            return tree;
        }
        if (!(tree as any).type) {
            return tree;
        }
        const treeCopy = {} as any;
        for (const key in tree) {
            if (Object.prototype.hasOwnProperty.call(tree, key)) {
                const element = tree[key];
                if (element && typeof element === "object") {
                    treeCopy[key] = this.replace(element, from, to);
                    continue;
                }
                treeCopy[key] = element;
            }
        }
        Object.setPrototypeOf(treeCopy, Object.getPrototypeOf(tree));
        return treeCopy;
    }

}