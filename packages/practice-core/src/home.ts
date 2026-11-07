/**
 * «خصّص الرئيسية» (owner round 5, F-02 a; docs/plan/2026-11-07-owner-round-5.md §1): a signed-in member orders and
 * hides the sections of the home page; a visitor always sees {@link HOME_SECTIONS} in their fixed order.
 *
 * The member's choice is `Store.settings.homeSections` and syncs with the rest of the settings
 * (docs/plan/2026-10-practice-sync-contract.md, «Round 5»), so the web and the app show the same order. Absent means
 * «the defaults», and a section added in a later release appears at its default place in every stored order
 * ({@link resolveHomeSections}).
 *
 * Pure; never throws on stored input.
 */

/** Every home section, in the default (and visitor) order. Keys never change: they are stored in synced settings. */
export const HOME_SECTION_KEYS = [
  /** «ورد اليوم»: progress and inline circles for the unchecked habits (members only). */
  'wird',
  /** «نص اليوم» (F-23), with «⋯» for its source. */
  'daily-text',
  /** «شعبة الأسبوع» (F-18). */
  'week-branch',
  /** «مناسبة قريبة» (F-17). */
  'occasion',
  /** «أبواب الخير». */
  'doors',
  /** «في لحظات مثل هذه». */
  'moments',
  /** «تذكرة مختارة». */
  'featured',
  /** «المصادر». */
  'sources',
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export interface HomeSectionInfo {
  key: HomeSectionKey;
  ar: string;
  en: string;
  /** Shown to a member who never customised the page. */
  visibleByDefault: boolean;
  /** Only for a signed-in member (a visitor never sees it). */
  membersOnly: boolean;
}

/** In the default order. Titles are shared so both clients name the sections the same way (nav-map rule). */
export const HOME_SECTIONS: readonly HomeSectionInfo[] = [
  { key: 'wird', ar: 'ورد اليوم', en: "Today's practice", visibleByDefault: true, membersOnly: true },
  { key: 'daily-text', ar: 'نص اليوم', en: 'Text of the day', visibleByDefault: true, membersOnly: false },
  // Round 3 item 7: «شعبة الأسبوع» only for a member who chose to study the branches; showing the section is that choice.
  { key: 'week-branch', ar: 'شعبة الأسبوع', en: 'Branch of the week', visibleByDefault: false, membersOnly: false },
  { key: 'occasion', ar: 'مناسبة قريبة', en: 'Coming occasion', visibleByDefault: true, membersOnly: false },
  { key: 'doors', ar: 'أبواب الخير', en: 'Gateways of good', visibleByDefault: true, membersOnly: false },
  { key: 'moments', ar: 'في لحظات مثل هذه', en: 'In moments like these', visibleByDefault: true, membersOnly: false },
  { key: 'featured', ar: 'تذكرة مختارة', en: 'A chosen reminder', visibleByDefault: true, membersOnly: false },
  { key: 'sources', ar: 'المصادر', en: 'Sources', visibleByDefault: true, membersOnly: false },
];

/** One section in the member's order. */
export interface HomeSectionPref {
  key: HomeSectionKey;
  visible: boolean;
}

export function isHomeSectionKey(value: unknown): value is HomeSectionKey {
  return typeof value === 'string' && (HOME_SECTION_KEYS as readonly string[]).includes(value);
}

/** The defaults: every section in its order, with its default visibility. */
export function defaultHomeSections(): HomeSectionPref[] {
  return HOME_SECTIONS.map((s) => ({ key: s.key, visible: s.visibleByDefault }));
}

/**
 * Reads a stored list. Never throws: unknown keys, malformed entries and later duplicates are dropped; `null` when
 * nothing usable is left (the defaults apply). Known fields only, in the canonical order `{ key, visible }`.
 */
export function parseHomeSections(raw: unknown): HomeSectionPref[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<HomeSectionKey>();
  const out: HomeSectionPref[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    if (!isHomeSectionKey(r.key) || typeof r.visible !== 'boolean' || seen.has(r.key)) continue;
    seen.add(r.key);
    out.push({ key: r.key, visible: r.visible });
  }
  return out.length > 0 ? out : null;
}

/** First problem of a list sent by a client (the server's check), or null. Duplicates and unknown keys are errors. */
export function validateHomeSections(raw: unknown): string | null {
  if (!Array.isArray(raw)) return 'homeSections must be null or an array';
  if (raw.length === 0 || raw.length > HOME_SECTION_KEYS.length) return `homeSections must hold 1…${HOME_SECTION_KEYS.length} sections`;
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return 'homeSections entries must be {key, visible}';
    const r = item as Record<string, unknown>;
    if (!isHomeSectionKey(r.key)) return `homeSections key must be one of ${HOME_SECTION_KEYS.join(', ')}`;
    if (typeof r.visible !== 'boolean') return 'homeSections visible must be true or false';
    if (seen.has(r.key)) return 'homeSections keys must be unique';
    seen.add(r.key);
  }
  return null;
}

/**
 * The full order to render: the stored sections in their order, then every section the stored list does not know
 * (a newer release, or a list saved before it existed) inserted after the closest earlier default neighbour, with
 * its default visibility. `null` / absent → the defaults.
 */
export function resolveHomeSections(stored: readonly HomeSectionPref[] | null | undefined): HomeSectionPref[] {
  const clean = parseHomeSections(stored ?? null);
  if (!clean) return defaultHomeSections();
  const out = [...clean];
  for (const info of HOME_SECTIONS) {
    if (out.some((s) => s.key === info.key)) continue;
    // After the nearest section that comes before it in the default order (else first).
    const defaultIndex = HOME_SECTION_KEYS.indexOf(info.key);
    let at = 0;
    for (let i = defaultIndex - 1; i >= 0; i--) {
      const idx = out.findIndex((s) => s.key === HOME_SECTION_KEYS[i]);
      if (idx >= 0) {
        at = idx + 1;
        break;
      }
    }
    out.splice(at, 0, { key: info.key, visible: info.visibleByDefault });
  }
  return out;
}

/** The sections to render, in order. A visitor gets the fixed public order (members-only sections left out). */
export function visibleHomeSections(stored: readonly HomeSectionPref[] | null | undefined, member: boolean): HomeSectionKey[] {
  if (!member) return HOME_SECTIONS.filter((s) => !s.membersOnly && s.visibleByDefault).map((s) => s.key);
  return resolveHomeSections(stored)
    .filter((s) => s.visible)
    .map((s) => s.key);
}

/** True when the list is the defaults (then it is stored as absent, so it follows future default changes). */
export function isDefaultHomeSections(list: readonly HomeSectionPref[]): boolean {
  return JSON.stringify(resolveHomeSections(list)) === JSON.stringify(defaultHomeSections());
}

/** «خصّص الرئيسية»: shows or hides one section. */
export function setHomeSectionVisible(
  list: readonly HomeSectionPref[] | null | undefined,
  key: HomeSectionKey,
  visible: boolean,
): HomeSectionPref[] {
  return resolveHomeSections(list).map((s) => (s.key === key ? { key: s.key, visible } : s));
}

/** «خصّص الرئيسية»: moves one section to `index` (clamped). */
export function moveHomeSection(list: readonly HomeSectionPref[] | null | undefined, key: HomeSectionKey, index: number): HomeSectionPref[] {
  const out = resolveHomeSections(list);
  const from = out.findIndex((s) => s.key === key);
  if (from < 0) return out;
  const [item] = out.splice(from, 1);
  const to = Math.max(0, Math.min(out.length, Math.trunc(index)));
  out.splice(to, 0, item as HomeSectionPref);
  return out;
}

/** The value to store: `undefined` for the defaults, else the full canonical list. */
export function homeSectionsToStore(list: readonly HomeSectionPref[] | null | undefined): HomeSectionPref[] | undefined {
  const full = resolveHomeSections(list);
  return isDefaultHomeSections(full) ? undefined : full;
}

/** JSON text of a member's choice (e.g. for a device cache); {@link parseHomeSections} reads it back. */
export function serializeHomeSections(list: readonly HomeSectionPref[] | null | undefined): string {
  return JSON.stringify(resolveHomeSections(list));
}

/** Copies a list in the canonical field order (Postgres `jsonb` reorders object keys). */
export function cloneHomeSections(list: readonly HomeSectionPref[]): HomeSectionPref[] {
  return list.map((s) => ({ key: s.key, visible: s.visible }));
}
