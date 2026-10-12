import type { CorpusSpec } from '../lib/corpus.js';

/** OpenITI/RELEASE commit that last touched both JK files. */
export const SAHIHAYN_COMMIT = 'a7b7fe07f523fe04a9dbdb4fa0c4e86968b3d76e';

export const BUKHARI_CORPUS: CorpusSpec = {
  repo: 'RELEASE',
  path: 'data/0256Bukhari/0256Bukhari.Sahih/0256Bukhari.Sahih.JK000110-ara1.completed',
  commit: SAHIHAYN_COMMIT,
  sha256: '69e95684acfde24171d29dd7ba43ff2c8f9b54ade5e3ab0a73899c06671082b7',
};

export const MUSLIM_CORPUS: CorpusSpec = {
  repo: 'RELEASE',
  path: 'data/0261Muslim/0261Muslim.Sahih/0261Muslim.Sahih.JK000109-ara1',
  commit: SAHIHAYN_COMMIT,
  sha256: '32b8b949d80d22d3db81be52d8749bc191f12510c8afe19868589bc4b08605e8',
};
