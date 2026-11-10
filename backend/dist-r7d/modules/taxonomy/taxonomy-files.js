import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export const TAXONOMY_FILES = [
    'taxonomy.yaml',
    'topic-themes.yaml',
    'text-review.yaml',
    'hidden-quotes.yaml',
    'deed-schedules.yaml',
    'sin-programs.yaml',
    'heart-texts.yaml',
    'names-of-allah.yaml',
    'home-moments.yaml',
];
export function taxonomyFilePath(file) {
    return join(import.meta.dirname, '..', '..', '..', 'prisma', 'taxonomy', file);
}
export function readTaxonomyFile(file) {
    return readFileSync(taxonomyFilePath(file), 'utf8');
}
//# sourceMappingURL=taxonomy-files.js.map