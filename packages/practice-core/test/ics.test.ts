import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, foldLine, occurrencesToEvents, type IcsEvent } from '../src/index.js';

const NOW = new Date(Date.UTC(2026, 9, 28, 10, 11, 12));

/** UTF-8 octet count, computed independently of the implementation. */
function octets(s: string): number {
  return encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, 'x').length;
}

function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n');
}

function build(events: IcsEvent[]): string {
  return buildIcs({ calendarName: 'تذكرة', events, now: NOW });
}

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a;b,c\\d\nnew\r\nline\rend')).toBe('a\\;b\\,c\\\\d\\nnew\\nline\\nend');
    expect(escapeText('سبحان الله، والحمد لله; ثم')).toBe('سبحان الله، والحمد لله\\; ثم');
  });
});

describe('foldLine', () => {
  it('keeps a 75-octet line and folds a 76-octet one', () => {
    expect(foldLine('x'.repeat(75))).toBe('x'.repeat(75));
    expect(foldLine('x'.repeat(76))).toBe(`${'x'.repeat(75)}\r\n x`);
  });

  it('counts Arabic as 2 octets and never splits a character', () => {
    const line = `SUMMARY:${'ذكر'.repeat(40)}`;
    const physical = foldLine(line).split('\r\n');
    expect(physical.length).toBeGreaterThan(1);
    for (const p of physical) expect(octets(p)).toBeLessThanOrEqual(75);
    for (const p of physical.slice(1)) expect(p.startsWith(' ')).toBe(true);
    expect(physical.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line);
  });

  it('keeps surrogate pairs (4-octet characters) whole', () => {
    const physical = foldLine(`DESCRIPTION:${'🌙'.repeat(30)}`).split('\r\n');
    for (const p of physical) {
      expect(octets(p)).toBeLessThanOrEqual(75);
      expect(p).not.toMatch(/[\uD800-\uDBFF]$/);
      expect(p).not.toMatch(/^ ?[\uDC00-\uDFFF]/);
    }
  });
});

describe('buildIcs', () => {
  const title = 'تذكرة من ذكرى: صيام الأيام البيض، وهي الثالث عشر والرابع عشر والخامس عشر من كل شهر هجري';

  it('uses CRLF everywhere, ends with CRLF and wraps one VCALENDAR', () => {
    const ics = build([{ uid: 'a@thekra', title, date: '2026-10-24' }]);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(ics).toContain('PRODID:-//Thekra//practice-core//AR\r\n');
    expect(ics).toContain('X-WR-CALNAME:تذكرة\r\n');
  });

  it('folds long Arabic lines at 75 octets and unfolds back to the escaped value', () => {
    const [A, B, C] = ['سطر أول', 'سطر ثانٍ، وفيه فاصلة', 'وفاصلة منقوطة'];
    const ics = build([{ uid: 'a@thekra', title, description: `${A}\n${B}; ${C}`, date: '2026-10-24' }]);
    for (const physical of ics.split('\r\n')) expect(octets(physical)).toBeLessThanOrEqual(75);
    const lines = unfold(ics);
    expect(lines).toContain(`SUMMARY:${escapeText(title)}`);
    expect(lines).toContain(`DESCRIPTION:${A}\\n${B}\\; ${C}`);
  });

  it('writes all-day events as VALUE=DATE with an exclusive end', () => {
    const lines = unfold(build([{ uid: 'a@thekra', title: 't', date: '2026-12-31' }]));
    expect(lines).toContain('DTSTART;VALUE=DATE:20261231');
    expect(lines).toContain('DTEND;VALUE=DATE:20270101');
  });

  it('writes timed events in floating local time (no Z, no TZID)', () => {
    const ics = build([{ uid: 'b@thekra', title: 't', date: '2026-10-28', time: '05:30', durationMinutes: 15 }]);
    const lines = unfold(ics);
    expect(lines).toContain('DTSTART:20261028T053000');
    expect(lines).toContain('DURATION:PT15M');
    expect(ics).not.toContain('TZID');
    expect(lines.filter((l) => l.startsWith('DTSTART')).every((l) => !l.endsWith('Z'))).toBe(true);
  });

  it('stamps DTSTAMP in UTC from the given now', () => {
    expect(unfold(build([{ uid: 'a', title: 't', date: '2026-10-28' }]))).toContain('DTSTAMP:20261028T101112Z');
  });

  it('adds a VALARM only when asked', () => {
    const withAlarm = unfold(build([{ uid: 'a', title: 'تذكير', date: '2026-10-28', time: '20:00', alarmMinutesBefore: 10 }]));
    expect(withAlarm).toEqual(expect.arrayContaining(['BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT10M', 'END:VALARM']));
    expect(unfold(build([{ uid: 'a', title: 't', date: '2026-10-28', alarmMinutesBefore: 0 }]))).toContain('TRIGGER:PT0M');
    expect(build([{ uid: 'a', title: 't', date: '2026-10-28' }])).not.toContain('VALARM');
  });

  it('never writes RRULE and includes URL as-is', () => {
    const ics = build([{ uid: 'a', title: 't', date: '2026-10-28', url: 'https://thekra.vercel.app/ar/good-deeds/siyam?x=1,2' }]);
    expect(ics).not.toContain('RRULE');
    expect(unfold(ics)).toContain('URL:https://thekra.vercel.app/ar/good-deeds/siyam?x=1,2');
  });

  it('rejects invalid input', () => {
    expect(() => build([{ uid: 'a', title: 't', date: '2026-02-30' }])).toThrow(RangeError);
    expect(() => build([{ uid: 'a', title: 't', date: '2026-10-28', time: '25:00' }])).toThrow(RangeError);
    expect(() => build([{ uid: '', title: 't', date: '2026-10-28' }])).toThrow(RangeError);
    expect(() => build([{ uid: 'a', title: 't', date: '2026-10-28', alarmMinutesBefore: -5 }])).toThrow(RangeError);
    expect(() => build([{ uid: 'a', title: 't', date: '2026-10-28', url: 'https://x\r\nBEGIN:VEVENT' }])).toThrow(RangeError);
  });
});

describe('occurrencesToEvents', () => {
  it('expands a Hijri rule into explicit dated events with stable uids', () => {
    const events = occurrencesToEvents({ kind: 'hijriMonthDays', days: [13, 14, 15] }, '2026-10-20', '2026-10-31', {
      uidPrefix: 'white-days',
      uidSuffix: '@thekra.app',
      title: 'تذكرة من ذكرى',
      alarmMinutesBefore: 60,
    });
    expect(events.map((e) => e.uid)).toEqual([
      'white-days-20261024@thekra.app',
      'white-days-20261025@thekra.app',
      'white-days-20261026@thekra.app',
    ]);
    expect(events.every((e) => e.title === 'تذكرة من ذكرى' && e.alarmMinutesBefore === 60)).toBe(true);
    const ics = buildIcs({ calendarName: 'تذكرة', events, now: NOW });
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(3);
    expect(ics).not.toContain('RRULE');
  });

  it('defaults the uid suffix', () => {
    const [e] = occurrencesToEvents({ kind: 'daily' }, '2026-10-28', '2026-10-28', { uidPrefix: 'x', title: 't' });
    expect(e?.uid).toBe('x-20261028@thekra');
  });
});
