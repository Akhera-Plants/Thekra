/**
 * Pinned OpenITI corpus files. A file is fetched once from GitHub at its pinned
 * commit into `backend/.corpus/` (git-ignored, CC BY-NC-SA 4.0 — never
 * committed) and must match its pinned SHA-256 on every run.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export interface CorpusSpec {
  /** OpenITI repository, e.g. `0475AH`. */
  repo: string;
  /** Path inside the repository. */
  path: string;
  /** Last commit touching `path` (GitHub API `commits?path=`), pinned. */
  commit: string;
  sha256: string;
}

export interface CorpusFile {
  spec: CorpusSpec;
  /** OpenITI version URI, e.g. `0458Bayhaqi.ShucabIman.Shamela0010660-ara1`. */
  versionUri: string;
  /** Stable reference stored in `rawPayload.corpusUri`. */
  corpusUri: string;
  text: string;
}

/** Fields every imported row carries in `rawPayload`. */
export interface CorpusProvenance {
  corpusUri: string;
  corpusCommit: string;
  sha256: string;
}

const CORPUS_DIR = join(import.meta.dirname, '..', '..', '..', '.corpus');

export function provenanceOf(file: CorpusFile): CorpusProvenance {
  return { corpusUri: file.corpusUri, corpusCommit: file.spec.commit, sha256: file.spec.sha256 };
}

function sha256Hex(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function loadCorpus(spec: CorpusSpec): Promise<CorpusFile> {
  const versionUri = basename(spec.path);
  const localPath = join(CORPUS_DIR, versionUri);
  if (!existsSync(localPath)) {
    const url = `https://raw.githubusercontent.com/OpenITI/${spec.repo}/${spec.commit}/${spec.path}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Corpus download failed (${response.status}): ${url}`);
    mkdirSync(CORPUS_DIR, { recursive: true });
    writeFileSync(localPath, Buffer.from(await response.arrayBuffer()));
  }
  const content = readFileSync(localPath);
  const actual = sha256Hex(content);
  if (actual !== spec.sha256) {
    throw new Error(`Corpus checksum mismatch for ${versionUri}: expected ${spec.sha256}, got ${actual}`);
  }
  return {
    spec,
    versionUri,
    corpusUri: `OpenITI/${spec.repo}/${spec.path}`,
    text: content.toString('utf8'),
  };
}
