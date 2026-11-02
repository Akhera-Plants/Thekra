import { describe, expect, it } from 'vitest';
import { contextMatnAr } from './publish.js';

describe('contextMatnAr', () => {
  it('writes the reader text with its narrator lead (Muslim 1403)', () => {
    expect(contextMatnAr({
      isnadText: 'حدثنا عمرو بن علي حدثنا عبد الأعلى حدثنا هشام بن أبي عبد الله عن أبي الزبير عن جابر أن رسول الله صلى الله عليه وسلم',
      matnText: 'رأى امرأة فأتى امرأته زينب وهي تمعس منيئة لها',
    })).toBe('عن جابر أن رسول الله صلى الله عليه وسلم رأى امرأة فأتى امرأته زينب وهي تمعس منيئة لها');
  });

  it('rejoins a word an old split cut in two (Bukhari 5597)', () => {
    const text = contextMatnAr({
      isnadText: 'حدثنا يحيى بن بكير، حدثنا يعقوب بن عبد الرحمن القاري، عن أبي حازم، قال: سمعت سهل بن سعد الساعدي: أن أبا أسيد الساعدي دعا النبي صلى الله عليه وسلم لعرسه، فكانت امرأته خادمهم يومئذ، وهي العروس، فقال',
      matnText: 'ت: «ما تدرون ما أنقعت لرسول الله صلى الله عليه وسلم؟ أنقعت له تمرات من الليل في تور»',
    });
    expect(text?.startsWith('عن أبي حازم، قال: سمعت سهل بن سعد')).toBe(true);
    expect(text).toContain('فقالت: «ما تدرون');
  });

  it('stays null when the matn already stands with its narrator', () => {
    expect(contextMatnAr({ isnadText: '', matnText: 'عن أنس قال: قال رسول الله صلى الله عليه وسلم: «يسروا ولا تعسروا»' })).toBeNull();
  });
});
