import type { CorpusSpec } from '../lib/corpus.js';

/** OpenITI/RELEASE commit that last touched both JK files. */
export const SAHIHAYN_COMMIT = 'a7b7fe07f523fe04a9dbdb4fa0c4e86968b3d76e';

/** Abdul Baqi / Fath numbering. The JK file's numbers are a different sequence. */
export const BUKHARI_CORPUS: CorpusSpec = {
  repo: 'RELEASE',
  path: 'data/0256Bukhari/0256Bukhari.Sahih/0256Bukhari.Sahih.Shamela0001681-ara1',
  commit: SAHIHAYN_COMMIT,
  sha256: '16f95173b9ea1927b577ff85dc7e2a8351b8287e4ea9863782c4c5fc87ac8132',
};

export const MUSLIM_CORPUS: CorpusSpec = {
  repo: 'RELEASE',
  path: 'data/0261Muslim/0261Muslim.Sahih/0261Muslim.Sahih.JK000109-ara1',
  commit: SAHIHAYN_COMMIT,
  sha256: '32b8b949d80d22d3db81be52d8749bc191f12510c8afe19868589bc4b08605e8',
};
