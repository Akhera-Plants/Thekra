#!/usr/bin/env node
/**
 * CI guard: ar.json and en.json must have the same key set (frontend messages).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arPath = resolve(root, 'frontend/messages/ar.json');
const enPath = resolve(root, 'frontend/messages/en.json');

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const ar = JSON.parse(readFileSync(arPath, 'utf8'));
const en = JSON.parse(readFileSync(enPath, 'utf8'));
const arKeys = new Set(flattenKeys(ar));
const enKeys = new Set(flattenKeys(en));

const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));

if (missingInEn.length || missingInAr.length) {
  console.error('i18n key mismatch between ar.json and en.json');
  if (missingInEn.length) {
    console.error('Missing in en:', missingInEn.slice(0, 20).join(', '));
    if (missingInEn.length > 20) console.error(`… and ${missingInEn.length - 20} more`);
  }
  if (missingInAr.length) {
    console.error('Missing in ar:', missingInAr.slice(0, 20).join(', '));
    if (missingInAr.length > 20) console.error(`… and ${missingInAr.length - 20} more`);
  }
  process.exit(1);
}

console.log(`i18n keys OK (${arKeys.size} keys)`);
