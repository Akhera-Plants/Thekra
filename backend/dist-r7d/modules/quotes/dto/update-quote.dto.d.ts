import { CreateQuoteDto } from './create-quote.dto.js';
declare class NonNullableQuoteFields {
    textAr?: string;
    sourceId?: string;
}
declare const UpdateQuoteDto_base: import("@nestjs/mapped-types").MappedType<NonNullableQuoteFields & Partial<Omit<CreateQuoteDto, "type" | "origin" | "textAr" | "sourceId">>>;
export declare class UpdateQuoteDto extends UpdateQuoteDto_base {
}
export {};
