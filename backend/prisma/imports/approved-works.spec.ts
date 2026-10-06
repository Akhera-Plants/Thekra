import { describe, expect, it } from 'vitest';
import { APPROVED_WORKS } from './approved-works.js';

describe('APPROVED_WORKS', () => {
  it('lists only the works the owner named', () => {
    expect(APPROVED_WORKS.map((work) => work.bookKey).sort()).toEqual([
      'book:adab-al-mufrad',
      'book:dhahabi-kabair',
      'book:mundhiri-targhib',
      'book:nawawi-riyad',
    ]);
  });

  it('does not assign a whole-book grade to Al-Adab al-Mufrad', () => {
    const adab = APPROVED_WORKS.find((work) => work.bookKey === 'book:adab-al-mufrad');
    expect(adab?.gradeBy).toBe('albani-adab-split');
    expect(adab).not.toHaveProperty('importGrade');

    const dhahabi = APPROVED_WORKS.find((work) => work.bookKey === 'book:dhahabi-kabair');
    expect(dhahabi?.role).toBe('sin-rank');
    expect(dhahabi?.gradeBy).toBeNull();
  });
});
