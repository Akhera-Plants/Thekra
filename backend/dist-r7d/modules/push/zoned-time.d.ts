import type { LocalDate, LocalTime } from '@thekra/practice-core';
export declare function isValidTimeZone(timeZone: unknown): timeZone is string;
export declare function zonedParts(instant: Date, timeZone: string): {
    date: LocalDate;
    time: LocalTime;
};
export declare function zonedToUtc(date: LocalDate, time: LocalTime, timeZone: string): Date;
