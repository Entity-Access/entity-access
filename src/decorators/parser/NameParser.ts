const parsedName = Symbol("parsedName");

export default class NameParser {
    public static parseMember(text: ((a: any) => any)) {
        let name = text[parsedName];
        if (!name) {
            const t: string = text.toString();

            const index = t.lastIndexOf(".");
            name = t.substring(index + 1);
            text[parsedName] = name;
        }
        return name;
    }
}
