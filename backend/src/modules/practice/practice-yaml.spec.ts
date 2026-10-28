import { parseYaml } from './practice-yaml.js';

describe('parseYaml (reviewer-file subset)', () => {
  it('reads block mappings, sequences of mappings and flow values', () => {
    const text = [
      '# header comment',
      'occasions:',
      '  - key: arafah',
      "    titleEn: Fasting the Day of Arafah (9 Dhu al-Hijja) # trailing comment",
      '    rule: { kind: hijriYearly, month: 12, day: 9 }',
      "    slots: ['09:30', '11:00']",
      '    flag: true',
      '    none: null',
      '  - key: jumua',
      '    rule: { kind: weekdays, days: [5] }',
      'list:',
      '- a',
      '- b',
    ].join('\n');
    expect(parseYaml(text)).toEqual({
      occasions: [
        {
          key: 'arafah',
          titleEn: 'Fasting the Day of Arafah (9 Dhu al-Hijja)',
          rule: { kind: 'hijriYearly', month: 12, day: 9 },
          slots: ['09:30', '11:00'],
          flag: true,
          none: null,
        },
        { key: 'jumua', rule: { kind: 'weekdays', days: [5] } },
      ],
      list: ['a', 'b'],
    });
  });

  it('folds `>-` block scalars and keeps `|` lines; a # inside them is text', () => {
    const text = ['a: >-', '  first line', '  # not a comment', '', '  next paragraph', 'b: |', '  one', '  two', 'c: x'].join('\n');
    expect(parseYaml(text)).toEqual({ a: 'first line # not a comment\nnext paragraph', b: 'one\ntwo\n', c: 'x' });
  });

  it('splits an unquoted flow item at a comma, as YAML does, and keeps a quoted one whole', () => {
    expect(parseYaml("a: [When angry, fall silent]\nb: ['When angry, fall silent', 'it''s fine']")).toEqual({
      a: ['When angry', 'fall silent'],
      b: ['When angry, fall silent', "it's fine"],
    });
  });

  it('keeps Arabic plain scalars and apostrophes inside words', () => {
    expect(parseYaml("t: «سبحان الله وبحمده» صباحًا ومساءً\nu: two rak'ahs")).toEqual({
      t: '«سبحان الله وبحمده» صباحًا ومساءً',
      u: "two rak'ahs",
    });
  });

  it('throws with the file name and line on what it does not support', () => {
    expect(() => parseYaml('a: 1\na: 2', 'x.yaml')).toThrow('x.yaml:2: duplicate key "a"');
    expect(() => parseYaml('a:\n    b: 1\n  c: 2', 'x.yaml')).toThrow(/x\.yaml:3/);
    expect(() => parseYaml('a: [1, 2', 'x.yaml')).toThrow('x.yaml:1');
    expect(() => parseYaml('a: { b 1 }', 'x.yaml')).toThrow('x.yaml:1');
    expect(() => parseYaml('a:\n\t- b', 'x.yaml')).toThrow('tabs');
  });
});
