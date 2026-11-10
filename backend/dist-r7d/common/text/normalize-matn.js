import { normalizeArabic } from './arabic-normalizer.js';
export function normalizeMatn(input) {
    return normalizeArabic(input)
        .replace(/[^\u0600-\u06FF\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
//# sourceMappingURL=normalize-matn.js.map