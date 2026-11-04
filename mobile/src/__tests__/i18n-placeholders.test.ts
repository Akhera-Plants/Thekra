/**
 * Owner round 5: «أتممت {{{done}}} من {{{total}}}» reached the screen. i18next placeholders are `{{name}}`; a triple
 * brace is never valid in these files.
 */
import ar from '@/lib/i18n/ar.json';
import en from '@/lib/i18n/en.json';

function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (node && typeof node === 'object') for (const v of Object.values(node)) strings(v, out);
  return out;
}

describe('i18n placeholders', () => {
  it.each([['ar', ar], ['en', en]])('%s has no triple-brace placeholder', (_name, messages) => {
    expect(strings(messages).filter((s) => s.includes('{{{') || s.includes('}}}'))).toEqual([]);
  });
});
