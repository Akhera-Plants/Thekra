export declare class CreateReminderSetDto {
    slug: string;
    titleAr: string;
    titleEn: string;
    sortOrder?: number;
    published?: boolean;
}
declare const UpdateReminderSetDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateReminderSetDto>>;
export declare class UpdateReminderSetDto extends UpdateReminderSetDto_base {
}
export declare class SetReminderSetItemsDto {
    quoteIds: string[];
}
export {};
