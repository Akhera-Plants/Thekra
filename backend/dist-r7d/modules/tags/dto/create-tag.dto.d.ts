import { TagCategory } from '@prisma/client';
export declare class CreateTagDto {
    name: string;
    nameAr?: string;
    slug: string;
    category: TagCategory;
}
