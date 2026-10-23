import { GradeSource, HadithGrade } from '@prisma/client';
import { decideArnautRuling } from './import.js';

const hit = (book: 'ahmad' | 'ibnhibban', number: number, grade: HadithGrade, verdict = 'إسناده صحيح') => ({
  book,
  number,
  grade,
  verdict,
  score: 0.8,
});

describe('decideArnautRuling', () => {
  it('takes the stronger grade, cites Musnad Ahmad first, and flags the source', () => {
    expect(
      decideArnautRuling([
        hit('ibnhibban', 609, HadithGrade.SAHIH, 'حديث صحيح'),
        hit('ahmad', 10519, HadithGrade.SAHIH, 'إسناده صحيح على شرط مسلم'),
        hit('ahmad', 9000, HadithGrade.HASAN, 'إسناده حسن'),
      ]),
    ).toEqual({
      grade: HadithGrade.SAHIH,
      gradeSource: GradeSource.AHMAD_TAHQIQ,
      gradeReference: 'مسند أحمد (ط. قرطبة)، رقم 10519، صحيح ابن حبان، رقم 609',
      verdicts: ['إسناده صحيح على شرط مسلم', 'حديث صحيح'],
    });
  });

  it('uses the Ibn Hibban source when only Ibn Hibban graded it', () => {
    expect(decideArnautRuling([hit('ibnhibban', 4903, HadithGrade.HASAN, 'إسناده حسن')])?.gradeSource).toBe(
      GradeSource.IBN_HIBBAN_TAHQIQ,
    );
  });

  it('returns nothing without hits', () => {
    expect(decideArnautRuling([])).toBeNull();
  });
});
