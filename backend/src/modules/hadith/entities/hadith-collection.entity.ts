export interface HadithCollectionDto {
  id: string;
  name: string;
  nameAr: string | null;
  author: string | null;
  authorAr: string | null;
  isExternalApi: boolean;
  apiProvider: string | null;
  quoteCount: number;
  lastSyncedAt: Date | null;
}
