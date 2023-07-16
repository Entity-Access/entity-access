import * as mysql from "mysql2";

const escapeLiteral = (name: string) => mysql.escape(name);

const quotedLiteral = (name: string) => mysql.escapeId(name);

export const MySqlLiteral = {
    quotedLiteral,
    escapeLiteral
};