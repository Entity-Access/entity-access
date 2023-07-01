export default function SqlMethodTransformer(callee: string, args: string[]): string {
    switch (callee) {
        case "Sql.text.like":
            return `${args[0]} LIKE ${args[1]}`;
    }
    return;
}
