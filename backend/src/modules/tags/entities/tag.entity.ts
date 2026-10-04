import type { TagCategory } from '@prisma/client';

export interface TagDto {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  category: TagCategory;
}

export interface TagWithQuoteCountDto extends TagDto {
  quoteCount: number;
}
