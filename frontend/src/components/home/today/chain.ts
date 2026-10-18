/**
 * Display-only split of a narrated hadith into its chain and its text, for the reading folio.
 * The stored text is never changed: the chain stays on the page behind a disclosure.
 *
 * The chain ends at the last «قال:» before the first mention of the Prophet ﷺ
 * («…عن عبد الله بن بسر، قال: | كان رسول الله ﷺ…»). Anything that does not split
 * cleanly is shown whole.
 */

const CHAIN_OPENER = /^\s*(?:و?(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|أنبأني|ثنا|نا|أنا)(?=[\s،:]))/;
const PROPHET = /رسول الله|النبي|ﷺ/;
const SAID = /(?:،\s*)?(?:قال|قالت)\s*:\s*/g;
const MIN_TEXT = 24;

export interface ChainSplit {
  chain: string | null;
  text: string;
}

export function splitChain(full: string): ChainSplit {
  const source = full.trim();
  if (!CHAIN_OPENER.test(source)) return { chain: null, text: source };

  const prophetAt = source.search(PROPHET);
  if (prophetAt <= 0) return { chain: null, text: source };

  let cut = -1;
  for (const match of source.slice(0, prophetAt).matchAll(SAID)) {
    cut = (match.index ?? 0) + match[0].length;
  }
  if (cut <= 0) return { chain: null, text: source };

  const chain = source.slice(0, cut).replace(/[،:\s]+$/, '').trim();
  const text = source.slice(cut).trim();
  if (text.length < MIN_TEXT || CHAIN_OPENER.test(text)) return { chain: null, text: source };
  return { chain, text };
}
