import { describe, expect, it } from 'vitest';
import { combinedScore, wordOverlap } from '../../../src/common/text/match-score.js';
import { normalizeMatn } from '../../../src/common/text/normalize-matn.js';
import { STRONG_MATCH_SCORE } from '../../../src/common/text/match-score.js';
import { parseReviewTsv, reviewWrite } from './review.js';

describe('athar takhrij — audit 3 #32', () => {
  it('Abu Hurayra on fasting Ramadan matches the Bukhari 1901 matn at 0.75', () => {
    const athar =
      'عن أبي هريرة، قال: من صام رمضان إيمانا واحتسابا غفر له ما تقدم من ذنبه، ومن قام ليلة القدر إيمانا واحتسابا غفر له ما تقدم من ذنبه';
    const bukhari =
      'قال من قام ليله القدر ايمانا واحتسابا، غفر له ما تقدم من ذنبه، ومن صام رمضان ايمانا واحتسابا غفر له ما تقدم من ذنبه';
    const left = normalizeMatn(athar);
    const overlap = wordOverlap(left, bukhari);
    // pg_trgm similarity of these two matns.
    expect(combinedScore(0.84, overlap)).toBeGreaterThanOrEqual(STRONG_MATCH_SCORE);
  });
});

describe('athar review decisions', () => {
  const current = {
    atharReviewDecision: null,
    atharTextAr: 'النص',
    atharAttributionKind: 'SAID' as const,
  };

  it('keep overrides the text and the attribution', () => {
    const [row] = parseReviewTsv(
      'quoteId\tspeakerKey\tspeakerAr\tattribution\tbook\tnumber\tatharTextAr\tdecision\tcorrectedText\tcorrectedAttribution\n' +
        'q1\tumar\tعمر\tSAID\tشعب\t1\tالنص\tkeep\tالنص المصحح\tNARRATED\n',
    );
    expect(row).toBeDefined();
    const write = reviewWrite(current, row!);
    expect(write).toEqual({
      atharReviewDecision: 'KEEP',
      atharTextAr: 'النص المصحح',
      atharAttributionKind: 'NARRATED',
    });
    expect(reviewWrite({ ...current, ...write }, row!)).toBeNull();
  });

  it('drop is recorded, and a blank decision writes nothing', () => {
    const [drop, blank] = parseReviewTsv(
      'quoteId\tspeakerKey\tspeakerAr\tattribution\tbook\tnumber\tatharTextAr\tdecision\tcorrectedText\tcorrectedAttribution\n' +
        'q1\tumar\tعمر\tSAID\tشعب\t1\tالنص\tdrop\t\t\n' +
        'q2\tumar\tعمر\tSAID\tشعب\t2\tالنص\t\t\t\n',
    );
    expect(reviewWrite(current, drop!)).toEqual({ atharReviewDecision: 'DROP' });
    expect(reviewWrite({ ...current, atharReviewDecision: 'DROP' }, drop!)).toBeNull();
    expect(reviewWrite(current, blank!)).toBeNull();
  });
});
