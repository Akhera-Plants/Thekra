export function parsePrintedReference(value) {
    if (!value)
        return { referenceNumber: null, referenceLabel: null };
    const slash = value.match(/(\d+\/\d+)\s*$/);
    if (slash?.[1])
        return { referenceNumber: null, referenceLabel: slash[1] };
    const match = value.match(/(\d+)\s*(?:\(([^)]+)\))?\s*$/);
    if (!match?.[1])
        return { referenceNumber: null, referenceLabel: null };
    return {
        referenceNumber: Number(match[1]),
        referenceLabel: match[2] ?? null,
    };
}
export function utcDayNumber(date) {
    return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}
export function formatPrintedReference(input) {
    const work = input.locale === 'ar' ? input.workAr : input.workEn;
    if (!work)
        return null;
    if (input.locale === 'ar' && /[A-Za-z]/.test(work))
        return null;
    const { referenceNumber, referenceLabel } = input;
    if (referenceNumber == null && !referenceLabel)
        return null;
    if (referenceNumber == null) {
        return input.locale === 'ar' ? `${work}، ${referenceLabel}` : `${work} ${referenceLabel}`;
    }
    const mark = referenceLabel ? ` (${referenceLabel})` : '';
    return input.locale === 'ar'
        ? `${work}، رقم ${referenceNumber}${mark}`
        : `${work} ${referenceNumber}${mark}`;
}
//# sourceMappingURL=printed-reference.js.map