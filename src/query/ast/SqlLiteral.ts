export default class SqlLiteral {
    static escapeLiteral(str: string) {
        let hasBackslash = false;
        let escaped = "'";

        for (const c of str) {
          if (c === "'") {
            escaped += c + c;
          } else if (c === '\\') {
            escaped += c + c;
            hasBackslash = true;
          } else {
            escaped += c;
          }
        }

        escaped += "'";

        if (hasBackslash === true) {
          escaped = ' E' + escaped;
        }

        return escaped;
    }
}