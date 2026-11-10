import { HomeMomentTopic } from '@prisma/client';
export declare class CreateHomeMomentDto {
    key: string;
    topicType: HomeMomentTopic;
    topicSlug: string;
    labelAr: string;
    labelEn: string;
    situationAr?: string | null;
    situationEn?: string | null;
    icon: string;
    sortOrder?: number;
    published?: boolean;
}
declare const UpdateHomeMomentDto_base: import("@nestjs/mapped-types").MappedType<Partial<Omit<CreateHomeMomentDto, "key">>>;
export declare class UpdateHomeMomentDto extends UpdateHomeMomentDto_base {
}
export {};
