import { HadithGrade, QuoteType } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';
export const REMINDER_SET_MAX_ITEMS = 60;
export function eligibleQuoteClause(ids) {
    return {
        AND: [
            { id: { in: [...ids] } },
            { isAthar: false },
            {
                OR: [
                    { type: QuoteType.QURAN_VERSE },
                    { type: QuoteType.HADITH, grade: { in: [HadithGrade.SAHIH, HadithGrade.HASAN] } },
                ],
            },
            GradePolicy.readerClause(),
        ],
    };
}
//# sourceMappingURL=reminder-set-rules.js.map