'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiGet, apiPost } from '@/lib/api-client';
import { ArabicText } from '@/components/shared/ArabicText';

interface FlagRow {
  id: string;
  type: string;
  severity: string;
  status: string;
  quote: {
    id: string;
    textAr: string;
    grade: string | null;
    gradeAuthority: string | null;
    gradeReference: string | null;
    source: { nameAr: string | null; name: string };
  };
}

interface MatchRow {
  id: string;
  score: number;
  decision: string;
  referenceHadith: {
    book: string;
    number: number;
    matnText: string;
    kitab: string | null;
    bab: string | null;
  };
}

interface FlagDetail extends FlagRow {
  note: string | null;
  details: unknown;
  quote: FlagRow['quote'] & { matches: MatchRow[] };
}

const TYPES = ['', 'WEAK_MATCH', 'DUPLICATE_DIFFERENT_GRADE', 'QURAN_MISMATCH', 'OCR_SUSPECT', 'REFERENCE_MISMATCH', 'USER_REPORT'];
const SEVERITIES = ['', 'HIGH', 'MEDIUM', 'LOW'];

export function FlagsQueue() {
  const t = useTranslations('admin');
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [selected, setSelected] = useState<FlagDetail | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params: Record<string, string> = { status: 'OPEN', limit: '50' };
    if (type) params.type = type;
    if (severity) params.severity = severity;
    let current = true;
    void apiGet<FlagRow[]>('/review/flags', { params })
      .then((result) => {
        if (current) setRows(result.data);
      })
      .catch((caught: unknown) => {
        if (current) setError(caught instanceof Error ? caught.message : t('flags.empty'));
      });
    return () => {
      current = false;
    };
  }, [severity, t, type]);

  async function reload() {
    const params: Record<string, string> = { status: 'OPEN', limit: '50' };
    if (type) params.type = type;
    if (severity) params.severity = severity;
    const result = await apiGet<FlagRow[]>('/review/flags', { params });
    setRows(result.data);
  }

  async function openFlag(id: string) {
    const result = await apiGet<FlagDetail>(`/review/flags/${id}`);
    setSelected(result.data);
    setNote('');
  }

  async function act(path: string) {
    if (!selected) return;
    await apiPost(path, { note: note.trim() || undefined });
    setSelected(null);
    await reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('flags.title')}</h1>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('flags.type')}</span>
          <select className="min-h-11 rounded-md border border-border bg-background px-2" value={type} onChange={(event) => setType(event.target.value)}>
            {TYPES.map((item) => (
              <option key={item || 'all'} value={item}>{item ? t(`flags.types.${item}`) : t('flags.all')}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('flags.severity')}</span>
          <select className="min-h-11 rounded-md border border-border bg-background px-2" value={severity} onChange={(event) => setSeverity(event.target.value)}>
            {SEVERITIES.map((item) => (
              <option key={item || 'all'} value={item}>{item ? t(`flags.severities.${item}`) : t('flags.all')}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {rows.length === 0 ? <p>{t('flags.empty')}</p> : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className="min-h-11 w-full rounded-md border border-border px-3 py-2 text-start" onClick={() => void openFlag(row.id)}>
                <span className="text-sm text-muted-foreground">{t(`flags.severities.${row.severity}`)} · {t(`flags.types.${row.type}`)} · {row.quote.source.nameAr ?? row.quote.source.name}</span>
                <ArabicText as="p" size="sm" className="line-clamp-2">{row.quote.textAr}</ArabicText>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <section className="flex flex-col gap-4 border-t border-border pt-4">
          <h2 className="text-lg font-semibold">{t('flags.quote')}</h2>
          <ArabicText as="p">{selected.quote.textAr}</ArabicText>
          <p className="text-sm text-muted-foreground">
            {selected.quote.gradeAuthority} {selected.quote.gradeReference}
          </p>
          <h2 className="text-lg font-semibold">{t('flags.candidates')}</h2>
          <ul className="flex flex-col gap-4">
            {(selected.quote.matches ?? []).map((match) => (
              <li key={match.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <p className="text-sm">{match.referenceHadith.book === 'BUKHARI' ? 'البخاري' : 'مسلم'} {match.referenceHadith.number} · {match.score} · {t(`flags.decisions.${match.decision}`)}</p>
                <ArabicText as="p" size="sm">{match.referenceHadith.matnText}</ArabicText>
                <div className="flex gap-3">
                  <button type="button" className="min-h-11 underline-offset-2 hover:underline" onClick={() => void act(`/review/matches/${match.id}/confirm`)}>{t('flags.confirm')}</button>
                  <button type="button" className="min-h-11 underline-offset-2 hover:underline" onClick={() => void act(`/review/matches/${match.id}/reject`)}>{t('flags.reject')}</button>
                </div>
              </li>
            ))}
          </ul>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('flags.note')}</span>
            <textarea className="min-h-20 rounded-md border border-border bg-background px-2 py-2" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="flex gap-3">
            <button type="button" className="min-h-11 underline-offset-2 hover:underline" onClick={() => void act(`/review/flags/${selected.id}/resolve`)}>{t('flags.resolve')}</button>
            <button type="button" className="min-h-11 underline-offset-2 hover:underline" onClick={() => void act(`/review/flags/${selected.id}/dismiss`)}>{t('flags.dismiss')}</button>
          </div>
        </section>
      )}
    </div>
  );
}
