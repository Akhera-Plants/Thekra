import { describe, expect, it } from 'vitest';
import { splitChain } from './chain';

describe('splitChain', () => {
  it('moves the chain behind the companion’s «قال:»', () => {
    const full =
      'أخبرنا علي بن أحمد بن عبدان، قال: نا عمرو بن عثمان، عن عبد الله بن بسر، قال: كان رسول الله صلى الله عليه وسلم إذا أتى باب قوم لم يستقبل الباب';
    const { chain, text } = splitChain(full);
    expect(chain).toBe('أخبرنا علي بن أحمد بن عبدان، قال: نا عمرو بن عثمان، عن عبد الله بن بسر، قال');
    expect(text.startsWith('كان رسول الله')).toBe(true);
    expect(`${chain}: ${text}`.replace(/\s+/g, ' ')).toBe(full.replace(/\s+/g, ' '));
  });

  it('leaves texts without a chain whole', () => {
    expect(splitChain('نص قصير بلا سند يبقى كما هو كاملًا')).toEqual({
      chain: null,
      text: 'نص قصير بلا سند يبقى كما هو كاملًا',
    });
  });

  it('drops a short preface plus the chain («غيره: حدثني…»)', () => {
    const full =
      'غيره: حدثني الليث، حدثني عقيل، عن ابن شهاب، قال: أخبرني عبيد الله بن عبد الله، عن ابن عباس، عن عمر بن الخطاب رضي الله عنه، أنه قال: لما مات عبد الله بن أبي ابن سلول، دعي له رسول الله صلى الله عليه وسلم ليصلي عليه';
    const { text } = splitChain(full);
    expect(text.startsWith('لما مات')).toBe(true);
    expect(text.includes('حدثني الليث')).toBe(false);
  });

  it('shows the whole text when the remainder still opens with a chain', () => {
    const full = 'حدثنا فلان، قال: حدثنا فلان عن أبي هريرة أن رسول الله صلى الله عليه وسلم قال كلمة';
    expect(splitChain(full).chain).toBeNull();
  });
});
