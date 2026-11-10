export declare const TAXONOMY_FILES: readonly ["taxonomy.yaml", "topic-themes.yaml", "text-review.yaml", "hidden-quotes.yaml", "deed-schedules.yaml", "sin-programs.yaml", "heart-texts.yaml", "names-of-allah.yaml", "home-moments.yaml"];
export type TaxonomyFile = (typeof TAXONOMY_FILES)[number];
export declare function taxonomyFilePath(file: TaxonomyFile): string;
export declare function readTaxonomyFile(file: TaxonomyFile): string;
