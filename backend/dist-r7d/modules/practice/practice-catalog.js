import { isSlotSuitable, isValidTime, PEOPLE_CIRCLES, STAGE_MIN_DAYS, stagesFor, validateDeedWindow, validateRule, } from '@thekra/practice-core';
import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
import { topicBranches, topicSide } from '../taxonomy/topic-pairs.js';
import { heartTexts } from './heart-texts.js';
import { parseYaml } from './practice-yaml.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASES = ['text', 'organizational'];
const UNITS = ['times', 'count', 'minutes'];
const RAKAH_COUNTS = ['pairs', 'odd'];
const CATEGORIES = ['haqq_allah', 'haqq_ibad'];
const ALL_STAGES = [...new Set([...stagesFor('haqq_allah'), ...stagesFor('haqq_ibad')])];
function assertKnownFields(map, where, allowed) {
    const unknown = Object.keys(map).find((key) => !allowed.includes(key));
    if (unknown)
        throw new Error(`${where}: unknown field "${unknown}"`);
}
class Fields {
    map;
    where;
    constructor(map, where, allowed) {
        this.map = map;
        this.where = where;
        assertKnownFields(map, where, allowed);
    }
    fail(message) {
        throw new Error(`${this.where}: ${message}`);
    }
    has(key) {
        return this.map[key] !== undefined && this.map[key] !== null;
    }
    string(key) {
        const value = this.map[key];
        if (typeof value !== 'string' || value.trim() === '')
            this.fail(`${key} must be a non-empty string`);
        return value;
    }
    optionalString(key) {
        return this.has(key) ? this.string(key) : undefined;
    }
    integer(key, min) {
        const value = this.map[key];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < min)
            this.fail(`${key} must be an integer ≥ ${min}`);
        return value;
    }
    optionalInteger(key, min) {
        return this.has(key) ? this.integer(key, min) : undefined;
    }
    boolean(key) {
        const value = this.map[key];
        if (typeof value !== 'boolean')
            this.fail(`${key} must be true or false`);
        return value;
    }
    oneOf(key, values) {
        const value = this.string(key);
        if (!values.includes(value))
            this.fail(`${key} must be one of ${values.join(', ')}`);
        return value;
    }
    strings(key, pattern) {
        const value = this.map[key];
        if (!Array.isArray(value) || value.length === 0)
            this.fail(`${key} must be a non-empty list`);
        return value.map((item, index) => {
            if (typeof item !== 'string' || item.trim() === '')
                this.fail(`${key}[${index}] must be a non-empty string`);
            if (pattern && !pattern.test(item))
                this.fail(`${key}[${index}] "${item}" is not valid`);
            return item;
        });
    }
    stringsOrEmpty(key, pattern) {
        const value = this.map[key];
        if (Array.isArray(value) && value.length === 0)
            return [];
        return this.strings(key, pattern);
    }
    optionalStrings(key, pattern) {
        return this.has(key) ? this.strings(key, pattern) : undefined;
    }
    optionalIntegers(key) {
        if (!this.has(key))
            return undefined;
        const value = this.map[key];
        if (!Array.isArray(value) || !value.every((item) => typeof item === 'number' && Number.isInteger(item) && item > 0)) {
            this.fail(`${key} must be a list of positive integers`);
        }
        return value;
    }
    rule(key) {
        const value = this.map[key];
        const error = validateRule(value);
        if (error)
            this.fail(`${key}: ${error}`);
        return value;
    }
    mapping(key) {
        return asMap(this.map[key], `${this.where}.${key}`);
    }
}
function asMap(value, where) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error(`${where}: expected a mapping`);
    return value;
}
function asList(value, where) {
    if (!Array.isArray(value) || value.length === 0)
        throw new Error(`${where}: expected a non-empty list`);
    return value;
}
function assertTopic(fields, slug, side) {
    const found = topicSide(slug);
    if (found !== side) {
        fields.fail(`"${slug}" is ${found ? `a topic with side ${found}` : 'not a topic'} in taxonomy.yaml; expected side ${side}`);
    }
}
function assertSameLength(fields, ar, en, key) {
    if ((ar === undefined) !== (en === undefined))
        fields.fail(`${key}Ar and ${key}En must both be present or both absent`);
    if (ar && en && ar.length !== en.length) {
        fields.fail(`${key}Ar has ${ar.length} items but ${key}En has ${en.length} (quote an English item that contains a comma)`);
    }
}
function assertUniqueKeys(items, where) {
    const seen = new Set();
    for (const { key } of items) {
        if (seen.has(key))
            throw new Error(`${where}: duplicate key "${key}"`);
        seen.add(key);
    }
}
function readOccasion(value, where) {
    const f = new Fields(asMap(value, where), where, ['key', 'titleAr', 'titleEn', 'deed', 'rule', 'basis', 'evidence']);
    const occasion = {
        key: f.string('key'),
        titleAr: f.string('titleAr'),
        titleEn: f.string('titleEn'),
        deed: f.string('deed'),
        rule: f.rule('rule'),
        basis: f.oneOf('basis', BASES),
        evidence: f.strings('evidence', UUID),
    };
    if (!KEY.test(occasion.key))
        f.fail(`key "${occasion.key}" must be kebab-case`);
    assertTopic(f, occasion.deed, 'DO');
    return occasion;
}
const HABIT_FIELDS = [
    'key', 'kind', 'people', 'titleAr', 'titleEn', 'deed', 'unit', 'unitLabelAr', 'unitLabelEn', 'rakah', 'start', 'ceiling', 'defaultRule',
    'timeHintAr', 'timeHintEn', 'defaultSlots', 'window', 'basis', 'evidence',
];
function readHabit(value, where) {
    const f = new Fields(asMap(value, where), where, HABIT_FIELDS);
    const start = new Fields(f.mapping('start'), `${where}.start`, ['far', 'near']);
    const ceiling = f.optionalInteger('ceiling', 1);
    const rakah = f.optionalString('rakah') !== undefined ? f.oneOf('rakah', RAKAH_COUNTS) : undefined;
    const timeHintAr = f.optionalString('timeHintAr');
    const timeHintEn = f.optionalString('timeHintEn');
    if ((timeHintAr === undefined) !== (timeHintEn === undefined))
        f.fail('timeHintAr and timeHintEn go together');
    const kind = f.optionalString('kind') !== undefined ? f.oneOf('kind', ['periodic']) : undefined;
    const people = f.optionalString('people') !== undefined ? f.oneOf('people', PEOPLE_CIRCLES) : undefined;
    if (people !== undefined && kind !== 'periodic')
        f.fail('people needs kind: periodic');
    const rawWindow = asMap(value, where)['window'];
    let window;
    if (rawWindow !== undefined && rawWindow !== null) {
        const error = validateDeedWindow(rawWindow);
        if (error)
            f.fail(error);
        window = rawWindow;
    }
    const habit = {
        key: f.string('key'),
        ...(kind !== undefined ? { kind } : {}),
        ...(people !== undefined ? { people } : {}),
        titleAr: f.string('titleAr'),
        titleEn: f.string('titleEn'),
        deed: f.string('deed'),
        unit: f.oneOf('unit', UNITS),
        unitLabelAr: f.string('unitLabelAr'),
        unitLabelEn: f.string('unitLabelEn'),
        ...(rakah !== undefined ? { rakah } : {}),
        start: { far: start.integer('far', 1), near: start.integer('near', 1) },
        ...(ceiling !== undefined ? { ceiling } : {}),
        defaultRule: f.rule('defaultRule'),
        ...(timeHintAr !== undefined && timeHintEn !== undefined ? { timeHintAr, timeHintEn } : {}),
        defaultSlots: f.strings('defaultSlots'),
        ...(window !== undefined ? { window } : {}),
        basis: f.oneOf('basis', BASES),
        evidence: kind === 'periodic' ? f.stringsOrEmpty('evidence', UUID) : f.strings('evidence', UUID),
    };
    if (!KEY.test(habit.key))
        f.fail(`key "${habit.key}" must be kebab-case`);
    if (people !== undefined && !['everyNDays', 'everyNWeeks', 'weekdays'].includes(habit.defaultRule.kind)) {
        f.fail('a people template needs an everyNDays, everyNWeeks or weekdays defaultRule (a person\'s rhythm)');
    }
    if (rakah !== undefined && habit.unit !== 'times')
        f.fail('rakah needs unit: times');
    if (habit.start.far > habit.start.near)
        f.fail('start.far must be ≤ start.near');
    if (ceiling !== undefined && ceiling < habit.start.near)
        f.fail('ceiling must be ≥ start.near');
    const badSlot = habit.defaultSlots.findIndex((slot) => !isValidTime(slot));
    if (badSlot >= 0)
        f.fail(`defaultSlots[${badSlot}] must be HH:MM`);
    const outside = habit.defaultSlots.find((slot) => !isSlotSuitable({ time: slot }, habit.window));
    if (outside !== undefined)
        f.fail(`defaultSlots: ${outside} is outside the deed's window`);
    assertTopic(f, habit.deed, 'DO');
    return habit;
}
function readProgramText(value, where) {
    const f = new Fields(asMap(value, where), where, ['titleAr', 'titleEn', 'bodyAr', 'bodyEn', 'lines', 'evidence']);
    const text = {
        titleAr: f.string('titleAr'),
        titleEn: f.string('titleEn'),
        bodyAr: f.string('bodyAr'),
        bodyEn: f.string('bodyEn'),
    };
    const lines = f.optionalIntegers('lines');
    const evidence = f.optionalStrings('evidence', UUID);
    if (lines)
        text.lines = lines;
    if (evidence)
        text.evidence = evidence;
    return text;
}
function readCommon(value, where) {
    const f = new Fields(asMap(value, where), where, [
        'willQuestionAr', 'willQuestionEn', 'stageMinDays', 'stages', 'afterFall', 'helpAr', 'helpEn',
    ]);
    const stagesMap = f.mapping('stages');
    assertKnownFields(stagesMap, `${where}.stages`, ALL_STAGES);
    const missing = ALL_STAGES.find((stage) => !Object.hasOwn(stagesMap, stage));
    if (missing)
        f.fail(`stages.${missing} is missing`);
    const stages = Object.fromEntries(Object.keys(stagesMap).map((stage) => [stage, readProgramText(stagesMap[stage], `${where}.stages.${stage}`)]));
    const common = {
        willQuestionAr: f.string('willQuestionAr'),
        willQuestionEn: f.string('willQuestionEn'),
        stageMinDays: f.integer('stageMinDays', 1),
        stages,
        afterFall: readProgramText(f.mapping('afterFall'), `${where}.afterFall`),
        helpAr: f.string('helpAr'),
        helpEn: f.string('helpEn'),
    };
    if (common.stageMinDays !== STAGE_MIN_DAYS) {
        f.fail(`stageMinDays ${common.stageMinDays} differs from practice-core STAGE_MIN_DAYS ${STAGE_MIN_DAYS}`);
    }
    return common;
}
const PROGRAM_FIELDS = [
    'sin', 'category', 'gradualAllowed', 'help', 'gradualStepsAr', 'gradualStepsEn', 'actionsAr', 'actionsEn',
    'alternatives', 'evidence', 'lines',
];
function readProgram(value, where, habitKeys) {
    const f = new Fields(asMap(value, where), where, PROGRAM_FIELDS);
    const gradualStepsAr = f.optionalStrings('gradualStepsAr');
    const gradualStepsEn = f.optionalStrings('gradualStepsEn');
    const lines = f.optionalIntegers('lines');
    const program = {
        sin: f.string('sin'),
        category: f.oneOf('category', CATEGORIES),
        gradualAllowed: f.boolean('gradualAllowed'),
        help: f.boolean('help'),
        ...(gradualStepsAr && gradualStepsEn ? { gradualStepsAr, gradualStepsEn } : {}),
        actionsAr: f.strings('actionsAr'),
        actionsEn: f.strings('actionsEn'),
        alternatives: f.strings('alternatives'),
        evidence: f.strings('evidence', UUID),
        ...(lines ? { lines } : {}),
    };
    assertTopic(f, program.sin, 'AVOID');
    if (program.category === 'haqq_ibad' && program.gradualAllowed) {
        f.fail('a haqq_ibad program must have gradualAllowed: false (roadmap §4.1)');
    }
    if (gradualStepsAr && !program.gradualAllowed)
        f.fail('gradualSteps need gradualAllowed: true');
    assertSameLength(f, gradualStepsAr, gradualStepsEn, 'gradualSteps');
    assertSameLength(f, program.actionsAr, program.actionsEn, 'actions');
    const unknown = program.alternatives.find((key) => !habitKeys.has(key));
    if (unknown)
        f.fail(`alternative "${unknown}" is not a habit key in deed-schedules.yaml`);
    return program;
}
export const MOMENT_TOOLS_MAX = 5;
function readMomentTools(value, where) {
    const tools = asList(value, where).map((item, index) => {
        const at = `${where}[${index}]`;
        const f = new Fields(asMap(item, at), at, ['key', 'titleAr', 'titleEn', 'evidence']);
        const tool = { key: f.string('key'), titleAr: f.string('titleAr'), titleEn: f.string('titleEn'), evidence: f.strings('evidence', UUID) };
        if (!KEY.test(tool.key))
            f.fail(`key "${tool.key}" must be kebab-case`);
        return tool;
    });
    if (tools.length > MOMENT_TOOLS_MAX)
        throw new Error(`${where}: at most ${MOMENT_TOOLS_MAX} acts`);
    assertUniqueKeys(tools, where);
    return tools;
}
function readMoment(value, where) {
    const raw = asMap(value, where);
    const f = new Fields(raw, where, ['generic', 'sins', 'aliases']);
    const sinsMap = f.mapping('sins');
    const sins = {};
    for (const slug of Object.keys(sinsMap)) {
        assertTopic(f, slug, 'AVOID');
        sins[slug] = readMomentTools(sinsMap[slug], `${where}.sins.${slug}`);
    }
    const aliasesMap = raw['aliases'] === undefined || raw['aliases'] === null ? {} : f.mapping('aliases');
    const aliases = {};
    for (const [slug, target] of Object.entries(aliasesMap)) {
        assertTopic(f, slug, 'AVOID');
        if (typeof target !== 'string' || !Object.hasOwn(sins, target))
            return f.fail(`aliases.${slug} must name a sin listed under sins`);
        if (Object.hasOwn(sins, slug))
            f.fail(`aliases.${slug} is also listed under sins`);
        aliases[slug] = target;
    }
    return { generic: readMomentTools(raw['generic'], `${where}.generic`), sins, aliases };
}
export function buildPracticeCatalog(schedulesText, programsText) {
    const schedules = asMap(parseYaml(schedulesText, 'deed-schedules.yaml'), 'deed-schedules.yaml');
    assertKnownFields(schedules, 'deed-schedules.yaml', ['occasions', 'habits']);
    const occasions = asList(schedules['occasions'], 'deed-schedules.yaml occasions').map((item, index) => readOccasion(item, `deed-schedules.yaml occasions[${index}]`));
    const habits = asList(schedules['habits'], 'deed-schedules.yaml habits').map((item, index) => readHabit(item, `deed-schedules.yaml habits[${index}]`));
    assertUniqueKeys(occasions, 'deed-schedules.yaml occasions');
    assertUniqueKeys(habits, 'deed-schedules.yaml habits');
    const circles = habits.flatMap((habit) => (habit.people ? [habit.people] : []));
    const twice = circles.find((circle, index) => circles.indexOf(circle) !== index);
    if (twice)
        throw new Error(`deed-schedules.yaml habits: two people templates for circle "${twice}"`);
    const programsFile = asMap(parseYaml(programsText, 'sin-programs.yaml'), 'sin-programs.yaml');
    const top = new Fields(programsFile, 'sin-programs.yaml', ['review', 'common', 'programs', 'moment']);
    const habitKeys = new Set(habits.map((habit) => habit.key));
    const programs = asList(programsFile['programs'], 'sin-programs.yaml programs').map((item, index) => readProgram(item, `sin-programs.yaml programs[${index}]`, habitKeys));
    assertUniqueKeys(programs.map((program) => ({ key: program.sin })), 'sin-programs.yaml programs');
    const deedBranches = {};
    for (const habit of habits) {
        const branches = topicBranches(habit.deed);
        if (branches.length > 0)
            deedBranches[habit.deed] = [...branches];
    }
    return {
        occasions,
        habits,
        sinPrograms: {
            review: top.string('review'),
            common: readCommon(programsFile['common'], 'sin-programs.yaml common'),
            programs,
            moment: readMoment(programsFile['moment'], 'sin-programs.yaml moment'),
        },
        deedBranches,
        stories: { ...heartTexts().stories },
        mujahada: mujahadaCopy(heartTexts().mujahada),
    };
}
function mujahadaCopy(m) {
    return {
        verses: m.verses.map((passage) => [...passage]),
        sayings: [...m.sayings],
        multiplierHadith: m.multiplierHadith,
        sittingPrayerHadith: m.sittingPrayerHadith,
        easyHighReward: [...m.easyHighReward],
    };
}
let cached = null;
export function practiceCatalog() {
    cached ??= buildPracticeCatalog(readTaxonomyFile('deed-schedules.yaml'), readTaxonomyFile('sin-programs.yaml'));
    return cached;
}
export function scheduleForDeed(slug) {
    const { habits, occasions } = practiceCatalog();
    return {
        habits: habits.filter((habit) => habit.deed === slug),
        occasions: occasions.filter((occasion) => occasion.deed === slug),
    };
}
export function programForSin(slug) {
    const program = practiceCatalog().sinPrograms.programs.find((entry) => entry.sin === slug);
    return { available: true, category: program ? program.category : null };
}
//# sourceMappingURL=practice-catalog.js.map