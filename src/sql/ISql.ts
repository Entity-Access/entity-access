export interface ISql {

    in<T>(a: T, array: T[]): boolean;

    cast: {
        asNumber(a: any): number;
        asInteger(a: any): number;
        asBigInt(a: any): number;
        asText(a: any): string;
        asDate(a: any): Date;
        asDateTime(a: any): Date;
        asDecimal(a: any): number;
    }

    text: {
        concat(... fragments: string[]): string;
        /**
         * Concat with separator
         * @param separator separator used to join
         * @param fragments text fragments
         */
        concatWS(separator: string, ... fragments: string[]): string;
        difference(left: string, right: string): number;
        like(text: string, test: string): boolean;
        iLike(text: string, test: string): boolean;
        left(text: string, length: number): string;
        right(text: string, length: number): string;
        startsWith(text: string, test: string): boolean;
        endsWith(text: string, test: string): boolean;
        /**
         * This will return index of given search, and it will
         * return -1 if test value is not found. If underlying provider
         * supports 1 as starting index, 1 will be subtracted from given result.
         * @param text string to be searched in
         * @param test string to search
         */
        indexOf(text: string, test: string): number;
        normalize(text: string, kind?: string): string;
        collate(text: string, collation: string): string;
        lower(text: string): string;
        upper(text: string): string;
        trim(text: string): string;

        reverse(text: string): string;

        /**
         * Create substring from the given string. Please note that the index you specify should be
         * zero based, and based on underlying provider, index will be incremented by one if provider
         * supports 1 as starting index.
         * @param text text
         * @param start start index, zero based, one will be added to support underlying database positioning
         * @param length length
         */
        substring(text: string, start: number, length?: number): string;
    },

    date: {
        yearOf(d: Date): number;
        monthOf(d: Date): number;
        dayOf(d: Date): number;
        minuteOf(d: Date): number;
        hourOf(d: Date): number;
        secondOf(d: Date): number;
        addYears(d: Date, n: number): Date;
        addMonths(d: Date, n: number): Date;
        addDays(d: Date, n: number): Date;
        addHours(d: Date, n: number): Date;
        addMinutes(d: Date, n: number): Date;
        addSeconds(d: Date, n: number): Date;
    }

}
