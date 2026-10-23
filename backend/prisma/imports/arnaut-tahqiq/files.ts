import type { CorpusSpec } from '../lib/corpus.js';

/**
 * Musnad Ahmad, Shamela «مسند أحمد - قرطبة» (Mu'assasat Qurtuba) with «تعليق شعيب الأرنؤوط»
 * after each narration. The other OpenITI versions of the Musnad carry no verdicts.
 */
export const MUSNAD_CORPUS: CorpusSpec = {
  repo: '0250AH',
  path: 'data/0241IbnHanbal/0241IbnHanbal.Musnad/0241IbnHanbal.Musnad.ShamAY0033964-ara2',
  commit: '0d7362515cf5cafd0ea9ebf4458e6d1fc22b5849',
  sha256: '9e5f117a6d4f20d43f4f8c44dcf9ec33cdbdf1f8c4b43a707caf33eeab58bf51',
};

/**
 * al-Ihsan fi Taqrib Sahih Ibn Hibban (Ibn Balban), al-Risala numbering: al-Albani's verdict
 * (block L) and Arna'ut's (block S) after each narration. Only S is read.
 */
export const IHSAN_CORPUS: CorpusSpec = {
  repo: '0750AH',
  path: 'data/0739CalaDinIbnBalban/0739CalaDinIbnBalban.Ihsan/0739CalaDinIbnBalban.Ihsan.Sham19Y0001734-ara1',
  commit: '9168f4a124537948de88cba6adfacf560bc35d35',
  sha256: 'c16b9c5a5b9ebc1329d22a07b9206558953df417a77337fe9b7673d1cc1afee3',
};
