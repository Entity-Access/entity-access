const escapeLiteral = (name: string) => {
    name = JSON.stringify(name).replace(/\'/g, "\\'");
    return `N'${name.substring(1, name.length - 1)}'`;
};

const quotedLiteral = (name: string) => `[${name}]`;

export const SqlServerLiteral = {

    escapeLiteral,
    quotedLiteral
};
