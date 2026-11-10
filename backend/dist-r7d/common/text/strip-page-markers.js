const CANDIDATE = /[\[(](?<vol>ج[ـ]?\d+\s+)?ص:?\s*\d+[\])]/gu;
function precededByVerseClose(text, pos) {
    let i = pos - 1;
    while (i >= 0) {
        const ch = text[i];
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '.') {
            i -= 1;
            continue;
        }
        return ch === '}' || ch === '\uFD3E';
    }
    return false;
}
export function stripPageMarkers(text) {
    const stripped = text.replace(CANDIDATE, (...args) => {
        const offset = args[args.length - 3];
        const fullStr = args[args.length - 2];
        return precededByVerseClose(fullStr, offset) ? args[0] : ' ';
    });
    return stripped.replace(/  +/g, ' ').trim();
}
//# sourceMappingURL=strip-page-markers.js.map