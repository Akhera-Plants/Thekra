import { STORY_MOMENTS } from '@thekra/practice-core';
import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
import { topicSide } from '../taxonomy/topic-pairs.js';
import { parseYaml } from './practice-yaml.js';
const FILE = 'heart-texts.yaml';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRANCH_KEY = /^branch-(\d+)$/;
export const MIZAN_MAX = 2;
export const MUJAHADA_VERSES_MAX = 15;
export const MUJAHADA_PASSAGE_MAX = 3;
export const MUJAHADA_SAYINGS_MAX = 10;
export const EASY_HIGH_REWARD_MAX = 10;
const TOP_LEVEL = ['review', 'mizan', 'stories', 'mujahadaVerses', 'mujahadaSayings', 'multiplierHadith', 'sittingPrayerHadith', 'easyHighReward'];
export const BRANCH_MAX = 77;
function fail(message) {
    throw new Error(`${FILE}: ${message}`);
}
function isMap(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isMizanKey(key) {
    const branch = BRANCH_KEY.exec(key);
    if (branch) {
        const n = Number(branch[1]);
        return n >= 1 && n <= BRANCH_MAX;
    }
    return topicSide(key) !== null;
}
export function buildHeartTexts(text) {
    const root = parseYaml(text, FILE);
    if (!isMap(root))
        fail('expected a mapping');
    const unknown = Object.keys(root).find((key) => !TOP_LEVEL.includes(key));
    if (unknown)
        fail(`unknown field "${unknown}"`);
    if (typeof root['review'] !== 'string' || !root['review'])
        fail('review must be a non-empty string');
    const mizanRaw = root['mizan'] ?? {};
    if (!isMap(mizanRaw))
        fail('mizan must be a mapping');
    const mizan = {};
    for (const [key, value] of Object.entries(mizanRaw)) {
        if (!isMizanKey(key))
            fail(`mizan "${key}" is not a taxonomy.yaml topic or branch-1…${BRANCH_MAX}`);
        if (!Array.isArray(value) || value.length === 0 || value.length > MIZAN_MAX) {
            fail(`mizan "${key}" must list 1 to ${MIZAN_MAX} Quote ids`);
        }
        const ids = value.map((id) => (typeof id === 'string' && UUID.test(id) ? id.toLowerCase() : fail(`mizan "${key}": "${String(id)}" is not a UUID`)));
        if (new Set(ids).size !== ids.length)
            fail(`mizan "${key}" lists an id twice`);
        mizan[key] = ids;
    }
    const storiesRaw = root['stories'];
    if (!isMap(storiesRaw))
        fail('stories must be a mapping');
    const expected = Object.values(STORY_MOMENTS);
    const keys = Object.keys(storiesRaw);
    const extra = keys.find((key) => !expected.includes(key));
    if (extra)
        fail(`stories "${extra}" is not a practice-core story key (${expected.join(', ')})`);
    const missing = expected.find((key) => !keys.includes(key));
    if (missing)
        fail(`stories "${missing}" is missing (leave it empty until its id is known)`);
    const stories = {};
    for (const key of expected) {
        const value = storiesRaw[key];
        if (value === null || value === '')
            stories[key] = null;
        else if (typeof value === 'string' && UUID.test(value))
            stories[key] = value.toLowerCase();
        else
            fail(`stories "${key}": "${String(value)}" is not a UUID or empty`);
    }
    return { review: root['review'], mizan, stories, mujahada: readMujahada(root) };
}
function uuidOf(value, where) {
    return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : fail(`${where}: "${String(value)}" is not a UUID`);
}
function optionalUuid(value, where) {
    return value === null || value === undefined || value === '' ? null : uuidOf(value, where);
}
function listOf(value, where, max) {
    if (value === null || value === undefined)
        return [];
    if (!Array.isArray(value))
        fail(`${where} must be a list`);
    if (value.length > max)
        fail(`${where} must list at most ${max} entries`);
    return value;
}
function readMujahada(root) {
    const verses = listOf(root['mujahadaVerses'], 'mujahadaVerses', MUJAHADA_VERSES_MAX).map((entry, index) => {
        const where = `mujahadaVerses[${index}]`;
        const ids = Array.isArray(entry) ? entry : [entry];
        if (ids.length === 0 || ids.length > MUJAHADA_PASSAGE_MAX)
            fail(`${where} must hold 1 to ${MUJAHADA_PASSAGE_MAX} verse ids`);
        return ids.map((id) => uuidOf(id, where));
    });
    const sayings = listOf(root['mujahadaSayings'], 'mujahadaSayings', MUJAHADA_SAYINGS_MAX).map((id, index) => uuidOf(id, `mujahadaSayings[${index}]`));
    const multiplierHadith = optionalUuid(root['multiplierHadith'], 'multiplierHadith');
    const sittingPrayerHadith = optionalUuid(root['sittingPrayerHadith'], 'sittingPrayerHadith');
    const all = [...verses.flat(), ...sayings, ...[multiplierHadith, sittingPrayerHadith].filter((id) => id !== null)];
    const twice = all.find((id, index) => all.indexOf(id) !== index);
    if (twice)
        fail(`the «لحظة مجاهدة» lists use ${twice} twice`);
    const easyHighReward = listOf(root['easyHighReward'], 'easyHighReward', EASY_HIGH_REWARD_MAX).map((slug, index) => {
        if (typeof slug !== 'string' || topicSide(slug) !== 'DO')
            fail(`easyHighReward[${index}]: "${String(slug)}" is not a taxonomy.yaml good deed`);
        return slug;
    });
    if (new Set(easyHighReward).size !== easyHighReward.length)
        fail('easyHighReward lists a topic twice');
    return { verses, sayings, multiplierHadith, sittingPrayerHadith, easyHighReward };
}
let cached = null;
export function heartTexts() {
    cached ??= buildHeartTexts(readTaxonomyFile(FILE));
    return cached;
}
export function mizanIdsFor(topic) {
    const key = typeof topic === 'number' ? `branch-${topic}` : topic;
    return heartTexts().mizan[key] ?? [];
}
//# sourceMappingURL=heart-texts.js.map