export default class NameParser {
    public static parseMember(text: ((a: any) => any)) {
        const t: string = text.toString();

        const index = t.lastIndexOf(".");
        return t.substring(index + 1);    
    }
}
