export function normalizeArabic(input) {
    return input
        .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED]/g, '')
        .replace(/\u0640/g, '')
        .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
        .replace(/\u0649/g, '\u064A')
        .replace(/\u0629/g, '\u0647');
}
export function escapeIlikePattern(q) {
    return q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
//# sourceMappingURL=arabic-normalizer.js.map