import DateTime from "../types/DateTime.js";

class GUID {}

interface IGeometry {
    x: number;
    y: number;
    srid: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IGeography extends IGeometry {
}

export interface ISql {

    in<T>(a: T, array: T[]): boolean;
    coll: {
        sum(a: number[]): number;
        count(a: any[]): number;
        avg(a: number[]): number
    },
    window: {
        rowNumber: {
            orderBy(order: number): number;
            orderByDescending(order: number): number;
            partitionByOrderBy(partition: any, order: number): number;
            partitionByOrderByDescending(partition: any, order: number): number;
        },
        rank: {
            orderBy(order: number): number;
            orderByDescending(order: number): number;
            partitionByOrderBy(partition: any, order: number): number;
            partitionByOrderByDescending(partition: any, order: number): number;
        }
        denseRank: {
            orderBy(order: number): number;
            orderByDescending(order: number): number;
            partitionByOrderBy(partition: any, order: number): number;
            partitionByOrderByDescending(partition: any, order: number): number;
        }
    },

    cast: {
        asNumber(a: any): number;
        asInteger(a: any): number;
        asBigInt(a: any): number;
        asText(a: any): string;
        asDate(a: any): DateTime;
        asDateTime(a: any): DateTime;
        asDecimal(a: any): number;
        asBoolean(a: any): boolean;
    },
    crypto: {
        randomUUID(): GUID
    },
    math: {
        min<T>(... a: T[]): T,
        max<T>(... a: T[]): T,
    },
    spatial: {
        /**
         * POINT(latitude, longitude, 4326) or POINT(x, y, 4326)
         * @param latitudeOrX latitude or x
         * @param longitudeOrY longitude or x
         * @param srid default should be 4326
         */
        point(latitudeOrX: number, longitudeOrY: number, srid?: number): IGeometry;
        distance(x: IGeometry, y: IGeometry): number;
        location(p: {latitude: number, longitude: number}): IGeometry;
    },
    json: {
        isJson(text: string): boolean;
        isArray(text: string): boolean;
        isObject(text: string): boolean;
        isScalar(text: string): boolean;
        isNotJson(text: string): boolean;
        isNotArray(text: string): boolean;
        isNotObject(text: string): boolean;
        isNotScalar(text: string): boolean;
    },
    text: {
        concat(... fragments: string[]): string;
        concatImmutable(... fragments: string[]): string;
        /**
         * Concat with separator
         * @param separator separator used to join
         * @param fragments text fragments
         */
        concatWS(separator: string, ... fragments: string[]): string;
        difference(left: string, right: string): number;
        like(text: string, test: string): boolean;
        iLike(text: string, test: string): boolean;
        likeAny(text: string, test: string[]): boolean;
        iLikeAny(text: string, test: string[]): boolean;

        left(text: string, length: number): string;
        length(text: string): number;
        right(text: string, length: number): string;
        startsWith(text: string, textToFind: string): boolean;
        endsWith(text: string, textToFind: string): boolean;
        /**
         * This will return index of given search, and it will
         * return -1 if test value is not found. If underlying provider
         * supports 1 as starting index, 1 will be subtracted from given result.
         * @param text string to be searched in
         * @param test string to search
         */
        indexOf(text: string, textToFind: string): number;
        includes(text: string, textToFind: string): boolean;
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

        /**
         * Check if given string is null or empty
         * @param text test string
         */
        isNullOrEmpty(text: string): boolean;
    },

    date: {
        now(): DateTime,
        yearOf(d: Date|DateTime): number;
        monthOf(d: Date|DateTime): number;
        dayOf(d: Date|DateTime): number;
        minuteOf(d: Date|DateTime): number;
        hourOf(d: Date|DateTime): number;
        secondOf(d: Date|DateTime): number;

        addYears<T extends Date | DateTime>(d: T, n: number): T;
        addMonths<T extends Date | DateTime>(d: T, n: number): T;
        addDays<T extends Date | DateTime>(d: T, n: number): T;
        addHours<T extends Date | DateTime>(d: T, n: number): T;
        addMinutes<T extends Date | DateTime>(d: T, n: number): T;
        addSeconds<T extends Date | DateTime>(d: T, n: number): T;
        epoch(d: DateTime);
    }

}
