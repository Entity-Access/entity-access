export const NamingConventions = {
    snakeCase: (text: string) => text.replace(/[A-Z]+/g, (letter, index) => index === 0 ? letter.toLowerCase() : '_'+ letter.toLowerCase()),
    snakeCaseCapital: (text: string) => text.replace(/[A-Z]+/g, (letter, index) => index === 0 ? letter.toUpperCase() : '_'+ letter.toUpperCase()),
    lowerCase: (text: string) => text.toLowerCase(),
    upperCase: (text: string) => text.toUpperCase(),
    pascalCase: (text: string) => text[0].toUpperCase() + text.substring(1)
};