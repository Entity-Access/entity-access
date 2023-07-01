
export type IStringTransformer = (s: string) => string;

export type ISqlMethodTransformer = (callee: string, args: string[]) => string;