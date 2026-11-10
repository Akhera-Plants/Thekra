const formatters = new Map();
function formatter(timeZone) {
    let f = formatters.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        });
        formatters.set(timeZone, f);
    }
    return f;
}
export function isValidTimeZone(timeZone) {
    if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 64)
        return false;
    try {
        formatter(timeZone);
        return true;
    }
    catch {
        return false;
    }
}
function wallClockMillis(instant, timeZone) {
    const parts = {};
    for (const part of formatter(timeZone).formatToParts(new Date(instant))) {
        if (part.type !== 'literal')
            parts[part.type] = Number(part.value);
    }
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}
export function zonedParts(instant, timeZone) {
    const iso = new Date(wallClockMillis(instant.getTime(), timeZone)).toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
export function zonedToUtc(date, time, timeZone) {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const wall = Date.UTC(y, m - 1, d, hh, mm);
    const offsetAt = (instant) => wallClockMillis(instant, timeZone) - instant;
    return new Date(wall - offsetAt(wall - offsetAt(wall)));
}
//# sourceMappingURL=zoned-time.js.map