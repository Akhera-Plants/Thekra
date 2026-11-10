import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ARCHIVE_MAX, cloneDayStates, cloneReflection, compareQadaLogs, compareReadMarks, compareReflections, isQadaKey, isQuoteId, isReciterKey, parseDayStates, parseQadaPlan, QADA_DAY_MAX, READS_MAX, validateDayStates, validateQadaPlan, validateReflectionTexts, compareFardMarks, compareVersions, isFardPrayer, isFardStatus, parseHomeSections, validateHomeSections, MAX_EXCUSED_DAYS, PEOPLE_CIRCLES, settingsContent, cloneHabitLoop, isPrayerAnchor, isValidDate, isValidTime, mergeLogEntry, planFields, relativeFields, validatePlan, validateRelative, validateHabitLoops, validateRule, } from '@thekra/practice-core';
export const MAX_SYNC_ITEMS = 500;
export const MAX_LIVE_PLANS = 50;
export const MAX_LIVE_RELATIVES = 200;
export const MAX_ARCHIVED_PLANS = ARCHIVE_MAX;
export const MAX_READ_MARKS = READS_MAX;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_AMOUNT = 100_000;
const MAX_REMINDER_TIMES = 12;
const MAX_TITLE = 200;
const MAX_SLUG = 100;
const MAX_RELATION = 60;
const MAX_SLOTS = 12;
class ItemError extends Error {
}
function invalid(kind, index, reason) {
    return new BadRequestException({
        code: 'PRACTICE_INVALID',
        message: `Invalid ${kind}${index === null ? '' : `[${index}]`}: ${reason}`,
        details: { kind, index, reason },
    });
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isInt(value, min, max) {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
function isAmount(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_AMOUNT;
}
export function containsProgramsKey(value) {
    const pending = [value];
    while (pending.length > 0) {
        const current = pending.pop();
        if (Array.isArray(current))
            pending.push(...current);
        else if (typeof current === 'object' && current !== null) {
            if (Object.hasOwn(current, 'programs'))
                return true;
            pending.push(...Object.values(current));
        }
    }
    return false;
}
function timestamp(value, field) {
    if (typeof value !== 'string' || !ISO_UTC.test(value) || Number.isNaN(Date.parse(value))) {
        throw new ItemError(`${field} must be an ISO 8601 UTC timestamp`);
    }
    return new Date(value).toISOString();
}
function optionalTimestamp(value, field) {
    return value === null || value === undefined ? null : timestamp(value, field);
}
function uuid(value, field) {
    if (typeof value !== 'string' || !UUID.test(value))
        throw new ItemError(`${field} must be a UUID`);
    return value;
}
function date(value, field) {
    if (!isValidDate(value))
        throw new ItemError(`${field} must be YYYY-MM-DD`);
    return value;
}
function optionalDate(value, field) {
    return value === null || value === undefined ? null : date(value, field);
}
function check(error) {
    if (error)
        throw new ItemError(error);
}
function parseSettings(raw) {
    if (!isRecord(raw))
        throw new ItemError('settings must be an object');
    const reminderTimes = raw['reminderTimes'] ?? [];
    if (!Array.isArray(reminderTimes) || reminderTimes.length > MAX_REMINDER_TIMES || !reminderTimes.every(isValidTime)) {
        throw new ItemError(`reminderTimes must be at most ${MAX_REMINDER_TIMES} HH:MM values`);
    }
    const hijriOffset = raw['hijriOffset'] ?? 0;
    if (!isInt(hijriOffset, -2, 2))
        throw new ItemError('hijriOffset must be an integer −2…2');
    const freeMinutesPerDay = raw['freeMinutesPerDay'] ?? null;
    if (freeMinutesPerDay !== null && !isInt(freeMinutesPerDay, 0, 1440)) {
        throw new ItemError('freeMinutesPerDay must be null or an integer 0…1440');
    }
    const excusedDays = raw['excusedDays'] ?? [];
    if (!Array.isArray(excusedDays) ||
        excusedDays.length > MAX_EXCUSED_DAYS ||
        !excusedDays.every(isValidDate) ||
        excusedDays.some((day, index) => index > 0 && day <= excusedDays[index - 1])) {
        throw new ItemError(`excusedDays must be at most ${MAX_EXCUSED_DAYS} YYYY-MM-DD dates, ascending and unique`);
    }
    const rawHome = raw['homeSections'] ?? null;
    if (rawHome !== null)
        check(validateHomeSections(rawHome));
    const fardTracking = raw['fardTracking'] ?? false;
    if (typeof fardTracking !== 'boolean')
        throw new ItemError('fardTracking must be true or false');
    const rawStates = raw['dayStates'] ?? null;
    if (rawStates !== null)
        check(validateDayStates(rawStates));
    const rawQada = raw['qada'] ?? null;
    if (rawQada !== null)
        check(validateQadaPlan(rawQada));
    const lightenCovered = raw['lightenCovered'] ?? true;
    if (typeof lightenCovered !== 'boolean')
        throw new ItemError('lightenCovered must be true or false');
    const reciter = raw['reciter'] ?? null;
    if (reciter !== null && !isReciterKey(reciter))
        throw new ItemError('reciter must be null or a known reciter key');
    const dayStates = rawStates === null ? [] : parseDayStates(rawStates);
    return {
        hijriOffset,
        reminderTimes: [...reminderTimes],
        freeMinutesPerDay,
        excusedDays: [...excusedDays],
        homeSections: rawHome === null ? null : parseHomeSections(rawHome),
        fardTracking,
        dayStates: dayStates.length > 0 ? cloneDayStates(dayStates) : null,
        qada: rawQada === null ? null : parseQadaPlan(rawQada),
        lightenCovered,
        reciter: reciter,
        clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt'),
    };
}
function parseSeason(raw) {
    if (raw === null || raw === undefined)
        return null;
    if (!isRecord(raw) || !isAmount(raw['amount']) || !isAmount(raw['previous'])) {
        throw new ItemError('season must be {amount, until, previous} with positive amounts');
    }
    return { amount: raw['amount'], until: date(raw['until'], 'season.until'), previous: raw['previous'] };
}
function parsePlan(raw) {
    if (!isRecord(raw))
        throw new ItemError('plan must be an object');
    const id = uuid(raw['id'], 'id');
    const clientUpdatedAt = timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt');
    const deletedAt = optionalTimestamp(raw['deletedAt'], 'deletedAt');
    if (deletedAt)
        return { kind: 'tombstone', id, clientUpdatedAt, deletedAt };
    const ceiling = raw['ceiling'] ?? null;
    const season = parseSeason(raw['season']);
    const ebbSince = optionalDate(raw['ebbSince'], 'ebbSince');
    const pausedOn = optionalDate(raw['pausedOn'], 'pausedOn');
    const resumedOn = optionalDate(raw['resumedOn'], 'resumedOn');
    const establishedOn = optionalDate(raw['establishedOn'], 'establishedOn');
    const rawAnchors = raw['slotAnchors'] ?? null;
    const slotAnchors = Array.isArray(rawAnchors) && rawAnchors.some((a) => a !== null) ? rawAnchors : null;
    if (rawAnchors !== null && !Array.isArray(rawAnchors))
        throw new ItemError('slotAnchors must be null or an array');
    const rawLoops = raw['loops'] ?? null;
    if (rawLoops !== null)
        check(validateHabitLoops(rawLoops));
    const loops = Array.isArray(rawLoops) && rawLoops.length > 0 ? rawLoops.map(cloneHabitLoop) : null;
    const minimum = raw['minimum'] ?? null;
    if (minimum !== null && !isAmount(minimum))
        throw new ItemError(`minimum must be null or a number above 0 and at most ${MAX_AMOUNT}`);
    const startAmount = raw['startAmount'] ?? null;
    if (startAmount !== null && !isAmount(startAmount))
        throw new ItemError(`startAmount must be null or a number above 0 and at most ${MAX_AMOUNT}`);
    const restartedOn = optionalDate(raw['restartedOn'], 'restartedOn');
    check(validatePlan({
        id,
        deedSlug: raw['deedSlug'],
        title: raw['title'],
        unit: raw['unit'],
        amount: raw['amount'],
        ...(ceiling === null ? {} : { ceiling }),
        activeDaysPerWeek: raw['activeDaysPerWeek'],
        slots: raw['slots'],
        createdOn: raw['createdOn'],
        amountChangedOn: raw['amountChangedOn'],
        log: {},
        ...(ebbSince ? { ebb: { since: ebbSince } } : {}),
        ...(season ? { season } : {}),
        ...(pausedOn ? { pausedOn } : {}),
        ...(resumedOn ? { resumedOn } : {}),
        ...(establishedOn ? { establishedOn } : {}),
        ...(slotAnchors ? { slotAnchors } : {}),
        ...(loops ? { loops } : {}),
        ...(minimum !== null ? { minimum } : {}),
        ...(startAmount !== null ? { startAmount } : {}),
        ...(restartedOn ? { restartedOn } : {}),
    }));
    const plan = raw;
    if (!isAmount(plan.amount))
        throw new ItemError(`amount must be a number above 0 and at most ${MAX_AMOUNT}`);
    if (ceiling !== null && !isAmount(ceiling))
        throw new ItemError(`ceiling must be null or a number above 0 and at most ${MAX_AMOUNT}`);
    if (plan.title.length > MAX_TITLE)
        throw new ItemError(`title must be at most ${MAX_TITLE} characters`);
    if (plan.deedSlug.length > MAX_SLUG || !SLUG.test(plan.deedSlug))
        throw new ItemError('deedSlug must be a kebab-case slug');
    if (plan.slots.length > MAX_SLOTS)
        throw new ItemError(`slots must hold at most ${MAX_SLOTS} times`);
    const habitKey = raw['habitKey'] ?? null;
    if (habitKey !== null && (typeof habitKey !== 'string' || habitKey.length > MAX_SLUG || !SLUG.test(habitKey))) {
        throw new ItemError('habitKey must be null or a kebab-case key');
    }
    const rule = raw['rule'] ?? null;
    if (rule !== null)
        check(validateRule(rule));
    return {
        kind: 'live',
        plan: {
            id,
            habitKey,
            deedSlug: plan.deedSlug,
            title: plan.title,
            unit: plan.unit,
            amount: plan.amount,
            ceiling,
            activeDaysPerWeek: plan.activeDaysPerWeek,
            slots: [...plan.slots],
            rule: rule,
            createdOn: plan.createdOn,
            amountChangedOn: plan.amountChangedOn,
            ebbSince,
            season,
            pausedOn,
            resumedOn,
            establishedOn,
            slotAnchors: slotAnchors ? [...slotAnchors] : null,
            loops,
            minimum: minimum,
            startAmount: startAmount,
            restartedOn,
            clientUpdatedAt,
            deletedAt: null,
        },
    };
}
function parseRelative(raw) {
    if (!isRecord(raw))
        throw new ItemError('relative must be an object');
    const id = uuid(raw['id'], 'id');
    const clientUpdatedAt = timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt');
    const deletedAt = optionalTimestamp(raw['deletedAt'], 'deletedAt');
    if (deletedAt)
        return { kind: 'tombstone', id, clientUpdatedAt, deletedAt };
    const lastContactedOn = optionalDate(raw['lastContactedOn'], 'lastContactedOn');
    const circle = raw['circle'] ?? 'kin';
    if (!PEOPLE_CIRCLES.includes(circle))
        throw new ItemError(`circle must be one of ${PEOPLE_CIRCLES.join(', ')}`);
    check(validateRelative({
        id,
        name: raw['name'],
        relation: raw['relation'],
        rule: raw['rule'],
        ...(lastContactedOn ? { lastContactedOn } : {}),
        history: [],
    }));
    const relation = raw['relation'];
    if (relation.length > MAX_RELATION)
        throw new ItemError(`relation must be at most ${MAX_RELATION} characters`);
    return {
        kind: 'live',
        relative: {
            id,
            name: raw['name'],
            relation,
            rule: raw['rule'],
            circle: circle,
            lastContactedOn,
            clientUpdatedAt,
            deletedAt: null,
        },
    };
}
function parseLog(raw) {
    if (!isRecord(raw))
        throw new ItemError('log must be an object');
    const correctedAt = optionalTimestamp(raw['correctedAt'], 'correctedAt');
    const amount = raw['amount'];
    if (!isAmount(amount) && !(correctedAt !== null && amount === 0)) {
        throw new ItemError(`amount must be a number above 0 (0 only with correctedAt) and at most ${MAX_AMOUNT}`);
    }
    const log = { planId: uuid(raw['planId'], 'planId'), date: date(raw['date'], 'date'), amount: amount };
    if (correctedAt !== null)
        log.correctedAt = correctedAt;
    return log;
}
function parseContact(raw) {
    if (!isRecord(raw))
        throw new ItemError('contact must be an object');
    const deleted = raw['deleted'] ?? false;
    if (typeof deleted !== 'boolean')
        throw new ItemError('deleted must be true or false');
    return { relativeId: uuid(raw['relativeId'], 'relativeId'), date: date(raw['date'], 'date'), deleted };
}
function parseFard(raw, latestDay) {
    if (!isRecord(raw))
        throw new ItemError('fard must be an object');
    const day = date(raw['date'], 'date');
    if (day > latestDay)
        throw new ItemError('date must not be in the future');
    if (!isFardPrayer(raw['prayer']))
        throw new ItemError('prayer must be one of fajr, dhuhr, asr, maghrib, isha');
    const status = raw['status'] ?? null;
    if (status !== null && !isFardStatus(status))
        throw new ItemError('status must be onTime, qada or null');
    return { date: day, prayer: raw['prayer'], status, clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt') };
}
function parseReflection(raw, latestDay) {
    if (!isRecord(raw))
        throw new ItemError('reflection must be an object');
    const day = date(raw['date'], 'date');
    if (day > latestDay)
        throw new ItemError('date must not be in the future');
    check(validateReflectionTexts(raw));
    const text = (k) => {
        const v = raw[k];
        return typeof v === 'string' && v.length > 0 ? v : null;
    };
    return {
        planId: uuid(raw['planId'], 'planId'),
        date: day,
        helped: text('helped'),
        hard: text('hard'),
        note: text('note'),
        clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt'),
    };
}
function parseQadaLog(raw, latestDay) {
    if (!isRecord(raw))
        throw new ItemError('qadaLog must be an object');
    const day = date(raw['date'], 'date');
    if (day > latestDay)
        throw new ItemError('date must not be in the future');
    if (!isQadaKey(raw['prayer']))
        throw new ItemError('prayer must be one of fajr, dhuhr, asr, maghrib, isha, any');
    if (!isInt(raw['count'], 0, QADA_DAY_MAX))
        throw new ItemError(`count must be an integer 0…${QADA_DAY_MAX}`);
    return { date: day, prayer: raw['prayer'], count: raw['count'], clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt') };
}
function parseRead(raw) {
    if (!isRecord(raw))
        throw new ItemError('read must be an object');
    if (!isQuoteId(raw['quoteId']))
        throw new ItemError('quoteId must be a UUID');
    if (typeof raw['read'] !== 'boolean')
        throw new ItemError('read must be true or false');
    return { quoteId: raw['quoteId'].toLowerCase(), read: raw['read'], clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt') };
}
export function coreReflection(r) {
    return cloneReflection({
        planId: r.planId,
        date: r.date,
        ...(r.helped ? { helped: r.helped } : {}),
        ...(r.hard ? { hard: r.hard } : {}),
        ...(r.note ? { note: r.note } : {}),
        updatedAt: r.clientUpdatedAt,
    });
}
export function reflectionWins(stored, incoming) {
    return stored === null || compareReflections(coreReflection(stored), coreReflection(incoming)) < 0;
}
export function qadaLogWins(stored, incoming) {
    return stored === null || compareQadaLogs({ count: stored.count, updatedAt: stored.clientUpdatedAt }, { count: incoming.count, updatedAt: incoming.clientUpdatedAt }) < 0;
}
export function readWins(stored, incoming) {
    return stored === null || compareReadMarks({ read: stored.read, updatedAt: stored.clientUpdatedAt }, { read: incoming.read, updatedAt: incoming.clientUpdatedAt }) < 0;
}
export function fardWins(stored, incoming) {
    if (stored === null)
        return true;
    return compareFardMarks({ status: stored.status, updatedAt: stored.clientUpdatedAt }, { status: incoming.status, updatedAt: incoming.clientUpdatedAt }) < 0;
}
function list(changes, kind) {
    const value = changes[kind] ?? [];
    if (!Array.isArray(value))
        throw invalid(kind, null, `${kind} must be an array`);
    return value;
}
function parseEach(items, kind, parse) {
    return items.map((raw, index) => {
        try {
            return parse(raw);
        }
        catch (error) {
            if (error instanceof ItemError)
                throw invalid(kind, index, error.message);
            throw error;
        }
    });
}
function preferLog(kept, next) {
    const entry = (log) => (log.correctedAt ? { amount: log.amount, correctedAt: log.correctedAt } : { amount: log.amount });
    const a = entry(kept);
    return mergeLogEntry(a, entry(next)) === a ? kept : next;
}
function dedupe(items, key, prefer = (_kept, next) => next) {
    const byKey = new Map();
    for (const item of items) {
        const k = key(item);
        const kept = byKey.get(k);
        byKey.set(k, kept === undefined ? item : prefer(kept, item));
    }
    return [...byKey.values()];
}
function corePlan(plan) {
    return {
        id: plan.id,
        deedSlug: plan.deedSlug,
        title: plan.title,
        unit: plan.unit,
        amount: plan.amount,
        ...(plan.ceiling === null ? {} : { ceiling: plan.ceiling }),
        activeDaysPerWeek: plan.activeDaysPerWeek,
        slots: plan.slots,
        createdOn: plan.createdOn,
        amountChangedOn: plan.amountChangedOn,
        log: {},
        ...(plan.ebbSince ? { ebb: { since: plan.ebbSince } } : {}),
        ...(plan.season ? { season: plan.season } : {}),
        ...(plan.habitKey ? { habitKey: plan.habitKey } : {}),
        ...(plan.rule ? { rule: plan.rule } : {}),
        ...(plan.pausedOn ? { pausedOn: plan.pausedOn } : {}),
        ...(plan.resumedOn ? { resumedOn: plan.resumedOn } : {}),
        ...(plan.establishedOn ? { establishedOn: plan.establishedOn } : {}),
        ...(plan.slotAnchors ? { slotAnchors: plan.slotAnchors } : {}),
        ...(plan.loops ? { loops: plan.loops } : {}),
        ...(plan.minimum !== null ? { minimum: plan.minimum } : {}),
        ...(plan.startAmount !== null ? { startAmount: plan.startAmount } : {}),
        ...(plan.restartedOn ? { restartedOn: plan.restartedOn } : {}),
    };
}
function coreRelative(relative) {
    return {
        id: relative.id,
        name: relative.name,
        relation: relative.relation,
        rule: relative.rule,
        ...(relative.circle !== 'kin' ? { circle: relative.circle } : {}),
        history: [],
    };
}
const tombstoneVersion = (clientUpdatedAt) => ({ time: Date.parse(clientUpdatedAt), deleted: true, content: '' });
export function planVersion(change) {
    if (change.kind === 'tombstone')
        return tombstoneVersion(change.clientUpdatedAt);
    return { time: Date.parse(change.plan.clientUpdatedAt), deleted: false, content: JSON.stringify(planFields(corePlan(change.plan))) };
}
export function relativeVersion(change) {
    if (change.kind === 'tombstone')
        return tombstoneVersion(change.clientUpdatedAt);
    return {
        time: Date.parse(change.relative.clientUpdatedAt),
        deleted: false,
        content: JSON.stringify(relativeFields(coreRelative(change.relative))),
    };
}
export function settingsVersion(settings) {
    return { time: Date.parse(settings.clientUpdatedAt), deleted: false, content: settingsContent(settings) };
}
export function wins(stored, incoming) {
    return stored === null || compareVersions(stored, incoming) < 0;
}
const changeId = (change) => change.kind === 'live' ? ('plan' in change ? change.plan.id : change.relative.id) : change.id;
export function parseSyncRequest(body, now = new Date()) {
    if (containsProgramsKey(body)) {
        throw new BadRequestException({
            code: 'PRACTICE_PROGRAMS_NOT_ALLOWED',
            message: 'The sin program is synced only as the encrypted sin vault',
        });
    }
    if (!isRecord(body))
        throw invalid('request', null, 'body must be an object');
    const sinceRaw = body['since'] ?? null;
    let since = null;
    if (sinceRaw !== null) {
        if (typeof sinceRaw !== 'string' || Number.isNaN(Date.parse(sinceRaw)) || !ISO_UTC.test(sinceRaw)) {
            throw invalid('request', null, 'since must be null or an ISO 8601 UTC timestamp');
        }
        since = new Date(sinceRaw);
    }
    const changes = body['changes'] ?? {};
    if (!isRecord(changes))
        throw invalid('request', null, 'changes must be an object');
    const raw = {
        plans: list(changes, 'plans'),
        logs: list(changes, 'logs'),
        relatives: list(changes, 'relatives'),
        contacts: list(changes, 'contacts'),
        fard: list(changes, 'fard'),
        reflections: list(changes, 'reflections'),
        qadaLogs: list(changes, 'qadaLogs'),
        reads: list(changes, 'reads'),
    };
    const settingsRaw = changes['settings'] ?? null;
    const total = raw.plans.length +
        raw.logs.length +
        raw.relatives.length +
        raw.contacts.length +
        raw.fard.length +
        raw.reflections.length +
        raw.qadaLogs.length +
        raw.reads.length +
        (settingsRaw ? 1 : 0);
    if (total > MAX_SYNC_ITEMS) {
        throw new PayloadTooLargeException({
            code: 'PRACTICE_TOO_LARGE',
            message: `A sync request may carry at most ${MAX_SYNC_ITEMS} items; send the rest in another request`,
        });
    }
    const [settings] = settingsRaw === null ? [null] : parseEach([settingsRaw], 'settings', parseSettings);
    const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
    return {
        since,
        settings: settings ?? null,
        plans: dedupe(parseEach(raw.plans, 'plans', parsePlan), changeId, (kept, next) => wins(planVersion(kept), planVersion(next)) ? next : kept),
        logs: dedupe(parseEach(raw.logs, 'logs', parseLog), (log) => `${log.planId}|${log.date}`, preferLog),
        relatives: dedupe(parseEach(raw.relatives, 'relatives', parseRelative), changeId, (kept, next) => wins(relativeVersion(kept), relativeVersion(next)) ? next : kept),
        contacts: dedupe(parseEach(raw.contacts, 'contacts', parseContact), (contact) => `${contact.relativeId}|${contact.date}`),
        fard: dedupe(parseEach(raw.fard, 'fard', (item) => parseFard(item, new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10))), (mark) => `${mark.date}|${mark.prayer}`, (kept, next) => (fardWins(kept, next) ? next : kept)),
        reflections: dedupe(parseEach(raw.reflections, 'reflections', (item) => parseReflection(item, tomorrow)), (r) => `${r.planId}|${r.date}`, (kept, next) => (reflectionWins(kept, next) ? next : kept)),
        qadaLogs: dedupe(parseEach(raw.qadaLogs, 'qadaLogs', (item) => parseQadaLog(item, tomorrow)), (l) => `${l.date}|${l.prayer}`, (kept, next) => (qadaLogWins(kept, next) ? next : kept)),
        reads: dedupe(parseEach(raw.reads, 'reads', parseRead), (m) => m.quoteId, (kept, next) => (readWins(kept, next) ? next : kept)),
    };
}
const day = (value) => value.toISOString().slice(0, 10);
const optionalDay = (value) => (value ? day(value) : null);
const iso = (value) => (value ? value.toISOString() : null);
export function planRowToWire(row) {
    return row.deletedAt ? deletedToWire(row.id, row.clientUpdatedAt, row.deletedAt) : planToWire(row);
}
export function relativeRowToWire(row) {
    return row.deletedAt ? deletedToWire(row.id, row.clientUpdatedAt, row.deletedAt) : relativeToWire(row);
}
function deletedToWire(id, clientUpdatedAt, deletedAt) {
    return { id, clientUpdatedAt: clientUpdatedAt.toISOString(), deletedAt: deletedAt.toISOString() };
}
export function planToWire(row) {
    return {
        id: row.id,
        habitKey: row.habitKey,
        deedSlug: row.deedSlug,
        title: row.title,
        unit: row.unit,
        amount: row.amount,
        ceiling: row.ceiling,
        activeDaysPerWeek: row.activeDaysPerWeek,
        slots: row.slots,
        rule: (row.rule ?? null),
        createdOn: day(row.createdOn),
        amountChangedOn: day(row.amountChangedOn),
        ebbSince: optionalDay(row.ebbSince),
        season: (row.season ?? null),
        pausedOn: optionalDay(row.pausedOn),
        resumedOn: optionalDay(row.resumedOn),
        establishedOn: optionalDay(row.establishedOn),
        slotAnchors: anchorsOf(row.slotAnchors),
        loops: loopsOf(row.loops),
        minimum: row.minimum,
        startAmount: row.startAmount,
        restartedOn: optionalDay(row.restartedOn),
        clientUpdatedAt: row.clientUpdatedAt.toISOString(),
        deletedAt: iso(row.deletedAt),
    };
}
export function relativeToWire(row) {
    return {
        id: row.id,
        name: row.name,
        relation: row.relation,
        rule: row.rule,
        circle: (PEOPLE_CIRCLES.includes(row.circle) ? row.circle : 'kin'),
        lastContactedOn: optionalDay(row.lastContactedOn),
        clientUpdatedAt: row.clientUpdatedAt.toISOString(),
        deletedAt: iso(row.deletedAt),
    };
}
const NO_ECHO = { settings: false, planIds: [], logKeys: [], relativeIds: [], contactKeys: [], fardKeys: [] };
export async function readPracticeChanges(db, userId, since, serverTime, echo = NO_ECHO) {
    const changed = since ? { updatedAt: { gt: since } } : {};
    const orEcho = (echoed) => (since ? { OR: [changed, ...echoed] } : {});
    const fardKeys = echo.fardKeys ?? [];
    const reflectionKeys = echo.reflectionKeys ?? [];
    const qadaKeys = echo.qadaKeys ?? [];
    const readIds = echo.readIds ?? [];
    const [settings, plans, logs, relatives, contacts, fard, reflections, qadaLogs, reads] = await Promise.all([
        db.practiceSettings.findFirst({ where: { userId, ...(echo.settings ? {} : changed) } }),
        db.habitPlan.findMany({ where: { userId, ...orEcho(echo.planIds.length ? [{ id: { in: echo.planIds } }] : []) }, orderBy: { id: 'asc' } }),
        db.habitLog.findMany({
            where: { plan: { userId }, ...orEcho(echo.logKeys.map((key) => ({ planId: key.planId, date: new Date(key.date) }))) },
            orderBy: [{ planId: 'asc' }, { date: 'asc' }],
        }),
        db.relative.findMany({
            where: { userId, ...orEcho(echo.relativeIds.length ? [{ id: { in: echo.relativeIds } }] : []) },
            orderBy: { id: 'asc' },
        }),
        db.relativeContact.findMany({
            where: {
                relative: { userId },
                ...orEcho(echo.contactKeys.map((key) => ({ relativeId: key.relativeId, date: new Date(key.date) }))),
            },
            orderBy: [{ relativeId: 'asc' }, { date: 'asc' }],
        }),
        db.fardMark.findMany({
            where: { userId, ...orEcho(fardKeys.map((key) => ({ date: new Date(key.date), prayer: key.prayer }))) },
            orderBy: [{ date: 'asc' }, { prayer: 'asc' }],
        }),
        db.habitReflection.findMany({
            where: { plan: { userId }, ...orEcho(reflectionKeys.map((key) => ({ planId: key.planId, date: new Date(key.date) }))) },
            orderBy: [{ date: 'asc' }, { planId: 'asc' }],
        }),
        db.qadaLog.findMany({
            where: { userId, ...orEcho(qadaKeys.map((key) => ({ date: new Date(key.date), prayer: key.prayer }))) },
            orderBy: [{ date: 'asc' }, { prayer: 'asc' }],
        }),
        db.quoteRead.findMany({
            where: { userId, ...orEcho(readIds.length ? [{ quoteId: { in: readIds } }] : []) },
            orderBy: [{ clientUpdatedAt: 'asc' }, { quoteId: 'asc' }],
        }),
    ]);
    return {
        serverTime: serverTime.toISOString(),
        settings: settings
            ? {
                hijriOffset: settings.hijriOffset,
                reminderTimes: settings.reminderTimes,
                freeMinutesPerDay: settings.freeMinutesPerDay,
                excusedDays: settings.excusedDays,
                homeSections: homeSectionsOf(settings.homeSections),
                fardTracking: settings.fardTracking,
                dayStates: dayStatesOf(settings.dayStates),
                qada: settings.qada === null ? null : parseQadaPlan(settings.qada),
                lightenCovered: settings.lightenCovered,
                reciter: isReciterKey(settings.reciter) ? settings.reciter : null,
                clientUpdatedAt: settings.clientUpdatedAt.toISOString(),
                updatedAt: settings.updatedAt.toISOString(),
            }
            : null,
        plans: plans.map(planRowToWire),
        logs: logs.map((log) => ({
            planId: log.planId,
            date: day(log.date),
            amount: log.amount,
            ...(log.correctedAt ? { correctedAt: log.correctedAt.toISOString() } : {}),
        })),
        relatives: relatives.map(relativeRowToWire),
        contacts: contacts.map((contact) => ({ relativeId: contact.relativeId, date: day(contact.date), deleted: contact.deletedAt !== null })),
        fard: fard.flatMap((mark) => isFardPrayer(mark.prayer) && (mark.status === null || isFardStatus(mark.status))
            ? [{ date: day(mark.date), prayer: mark.prayer, status: mark.status, clientUpdatedAt: mark.clientUpdatedAt.toISOString() }]
            : []),
        reflections: reflections.map((r) => ({
            planId: r.planId,
            date: day(r.date),
            helped: r.helped,
            hard: r.hard,
            note: r.note,
            clientUpdatedAt: r.clientUpdatedAt.toISOString(),
        })),
        qadaLogs: qadaLogs.flatMap((l) => isQadaKey(l.prayer) ? [{ date: day(l.date), prayer: l.prayer, count: l.count, clientUpdatedAt: l.clientUpdatedAt.toISOString() }] : []),
        reads: reads.map((m) => ({ quoteId: m.quoteId, read: m.read, clientUpdatedAt: m.clientUpdatedAt.toISOString() })),
    };
}
export function dayStatesOf(value) {
    if (value === null || value === undefined || validateDayStates(value) !== null)
        return null;
    const list = parseDayStates(value);
    return list.length > 0 ? cloneDayStates(list) : null;
}
export function homeSectionsOf(value) {
    if (value === null || value === undefined || validateHomeSections(value) !== null)
        return null;
    return parseHomeSections(value);
}
function anchorsOf(value) {
    if (!Array.isArray(value) || !value.every((a) => a === null || isPrayerAnchor(a)) || !value.some((a) => a !== null))
        return null;
    return value;
}
function loopsOf(value) {
    if (!Array.isArray(value) || value.length === 0 || validateHabitLoops(value) !== null)
        return null;
    return value.map(cloneHabitLoop);
}
//# sourceMappingURL=practice-sync.js.map