export interface ISql {

    in<T>(a: T, array: T[]): boolean;

    text: {
        concat(... fragments: string[]): string;
        like(text: string, test: string): boolean;
        iLike(text: string, test: string): boolean;
        left(text: string, length: number): string;
        right(text: string, length: number): string;
        startsWith(text: string, test: string): boolean;
        endsWith(text: string, test: string): boolean;
        indexOf(text: string, test: string): number;
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
