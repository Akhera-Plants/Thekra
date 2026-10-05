/**
 * grade.mapper.spec.ts
 *
 * Exhaustive table test for normalizeGrade and resolveWeakestGrade.
 * Covers every row in content-pipeline-plan §2.6 plus edge cases.
 */

import { describe, it, expect } from 'vitest';
import { HadithGrade } from '@prisma/client';
import { normalizeGrade, resolveWeakestGrade } from './grade.mapper.js';

describe('normalizeGrade', () => {
  // ── SAHIH ──────────────────────────────────────────────────────────────────
  it.each([
    ['sahih', HadithGrade.SAHIH],
    ['Sahih', HadithGrade.SAHIH],
    ['SAHIH', HadithGrade.SAHIH],
    ['صحيح', HadithGrade.SAHIH],
    ['sahih li ghairih', HadithGrade.SAHIH],
    ['صحيح لغيره', HadithGrade.SAHIH],
    ['authentic', HadithGrade.SAHIH],
    ['muttafaqun alayh', HadithGrade.SAHIH],
    ['متفق عليه', HadithGrade.SAHIH],
    ['Graded Sahih by Al-Albani', HadithGrade.SAHIH],
  ])('maps %s → SAHIH', (input, expected) => {
    expect(normalizeGrade(input).grade).toBe(expected);
    expect(normalizeGrade(input).unmapped).toBe(false);
  });

  // ── HASAN ──────────────────────────────────────────────────────────────────
  it.each([
    ['hasan', HadithGrade.HASAN],
    ['Hasan', HadithGrade.HASAN],
    ['حسن', HadithGrade.HASAN],
    ['hasan sahih', HadithGrade.HASAN],
    ['حسن صحيح', HadithGrade.HASAN],
    ['hasan li ghairih', HadithGrade.HASAN],
    ['حسن لغيره', HadithGrade.HASAN],
    ['good', HadithGrade.HASAN],
  ])('maps %s → HASAN', (input, expected) => {
    expect(normalizeGrade(input).grade).toBe(expected);
    expect(normalizeGrade(input).unmapped).toBe(false);
  });

  // ── DAIF ───────────────────────────────────────────────────────────────────
  it.each([
    ["da'if", HadithGrade.DAIF],
    ['daif', HadithGrade.DAIF],
    ['Daif', HadithGrade.DAIF],
    ['dhaeef', HadithGrade.DAIF],
    ['ضعيف', HadithGrade.DAIF],
    ['weak', HadithGrade.DAIF],
    ['munkar', HadithGrade.DAIF],
    ['منكر', HadithGrade.DAIF],
    ['shadh', HadithGrade.DAIF],
    ['شاذ', HadithGrade.DAIF],
  ])('maps %s → DAIF', (input, expected) => {
    expect(normalizeGrade(input).grade).toBe(expected);
    expect(normalizeGrade(input).unmapped).toBe(false);
  });

  // ── MAWDU ──────────────────────────────────────────────────────────────────
  it.each([
    ['mawdu', HadithGrade.MAWDU],
    ['Mawdu', HadithGrade.MAWDU],
    ['موضوع', HadithGrade.MAWDU],
    ['fabricated', HadithGrade.MAWDU],
    ['batil', HadithGrade.MAWDU],
    ['باطل', HadithGrade.MAWDU],
    ['la asla lahu', HadithGrade.MAWDU],
  ])('maps %s → MAWDU', (input, expected) => {
    expect(normalizeGrade(input).grade).toBe(expected);
    expect(normalizeGrade(input).unmapped).toBe(false);
  });

  // ── UNGRADED / empty ───────────────────────────────────────────────────────
  it.each([
    [null, HadithGrade.UNGRADED],
    [undefined, HadithGrade.UNGRADED],
    ['', HadithGrade.UNGRADED],
    ['   ', HadithGrade.UNGRADED],
  ])('maps %s → UNGRADED (not unmapped)', (input, expected) => {
    const r = normalizeGrade(input as string | null | undefined);
    expect(r.grade).toBe(expected);
    expect(r.unmapped).toBe(false);
  });

  it('marks unrecognised strings as unmapped', () => {
    // 'مجهول الحال' = "unknown status" — a real grade variant not in the table.
    const r = normalizeGrade('مجهول الحال');
    expect(r.grade).toBe(HadithGrade.UNGRADED);
    expect(r.unmapped).toBe(true);
  });

  it('marks another unrecognised string as unmapped', () => {
    expect(normalizeGrade('unknown-grade').unmapped).toBe(true);
  });
});

describe('resolveWeakestGrade', () => {
  it('returns SAHIH for a single Sahih entry', () => {
    const r = resolveWeakestGrade(['Sahih']);
    expect(r.grade).toBe(HadithGrade.SAHIH);
    expect(r.unmappedStrings).toHaveLength(0);
  });

  it('DAIF beats SAHIH (most conservative wins)', () => {
    const r = resolveWeakestGrade(['Sahih', "Da'if"]);
    expect(r.grade).toBe(HadithGrade.DAIF);
  });

  it('MAWDU beats everything', () => {
    const r = resolveWeakestGrade(['Sahih', 'Hasan', 'Mawdu']);
    expect(r.grade).toBe(HadithGrade.MAWDU);
  });

  it('HASAN beats SAHIH', () => {
    const r = resolveWeakestGrade(['Sahih', 'Hasan']);
    expect(r.grade).toBe(HadithGrade.HASAN);
  });

  it('collects unmapped strings', () => {
    // 'مجهول الحال' = "unknown status" — a real grade term not in the table.
    // 'totally unknown' is obviously not a grade.
    // Note: 'حسن غريب' WOULD match HASAN via substring since 'حسن' ⊂ 'حسن غريب'.
    const r = resolveWeakestGrade(['Sahih', 'مجهول الحال', 'totally unknown']);
    expect(r.unmappedStrings).toContain('مجهول الحال');
    expect(r.unmappedStrings).toContain('totally unknown');
  });

  it('returns UNGRADED for empty array', () => {
    const r = resolveWeakestGrade([]);
    expect(r.grade).toBe(HadithGrade.UNGRADED);
    expect(r.unmappedStrings).toHaveLength(0);
  });

  it('returns UNGRADED for all-null/empty array', () => {
    const r = resolveWeakestGrade([null, undefined, '']);
    expect(r.grade).toBe(HadithGrade.UNGRADED);
  });
});
