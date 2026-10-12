'use client';

/**
 * LinkingWorkspace — pick a sin → search unlinked quotes → set score + note → save.
 * Supports bulk-link for triage batches.
 *
 * Relevance rubric (visible inline, from backend-plan):
 *   100 = direct, explicit prohibition / command
 *   80  = strong, clear evidence
 *   60  = relevant but indirect
 *   40  = tangential / thematic
 *   20  = very weak connection
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getSins } from '@/lib/api/sins';
import { adminGetQuotes } from '@/lib/api/admin-quotes';
import {
  useAdminLinkSinQuote,
  useAdminSinQuotes,
  useAdminBulkLinkSinQuotes,
} from '../hooks/useAdminClassification';
import { AdminDataTable, type ColumnDef } from './AdminDataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArabicText } from '@/components/shared/ArabicText';
import { GradeBadge } from '@/components/shared/quote/GradeBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Link2 } from 'lucide-react';
import type { QuoteDto } from '@/lib/types/api';
import type { SinQuoteLinkDto } from '@/lib/types/admin';

// ── Rubric ────────────────────────────────────────────────────────────────────

const SCORE_OPTIONS = [100, 80, 60, 40, 20] as const;
const RUBRIC: Record<number, string> = {
  100: 'Direct, explicit prohibition or command',
  80: 'Strong, clear evidence',
  60: 'Relevant but indirect',
  40: 'Tangential / thematic',
  20: 'Very weak connection',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTranslations('admin');
  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(value)}
        onValueChange={(v) => onChange(Number(v))}
      >
        <SelectTrigger className="w-20" aria-label={t('linking.relevanceScore')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCORE_OPTIONS.map((s) => (
            <SelectItem key={s} value={String(s)}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t('linking.rubricInfo')}
            className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <ul className="text-xs space-y-1">
            {SCORE_OPTIONS.map((s) => (
              <li key={s}><strong>{s}</strong> — {RUBRIC[s]}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

interface LinkRowState {
  quoteId: string;
  score: number;
  note: string;
  selected: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export function LinkingWorkspace() {
  const t = useTranslations('admin');

  // ── Sin picker ────────────────────────────────────────────────────────────
  const [selectedSinId, setSelectedSinId] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: sinsResult } = useQuery({
    queryKey: queryKeys.sins.list({ limit: 100 }),
    queryFn: () => getSins({ limit: 100 }),
  });
  const sins = sinsResult?.data ?? [];

  // ── Quotes for selected sin (already linked, to detect duplicates) ────────
  const selectedSin = sins.find((s) => s.id === selectedSinId);
  const { data: linkedData } = useAdminSinQuotes({ sinId: selectedSinId });
  const linkedIds = useMemo(
    () => new Set((linkedData?.data ?? []).map((l: SinQuoteLinkDto) => l.quoteId)),
    [linkedData],
  );

  // ── Unlinked quotes ───────────────────────────────────────────────────────
  const quotesQuery = useMemo(
    () => ({ unlinkedOnly: true, q: search || undefined, limit: 30 }),
    [search],
  );
  const { data: quotesResult, isLoading: quotesLoading } = useQuery({
    queryKey: queryKeys.adminQuotes.list(quotesQuery),
    queryFn: () => adminGetQuotes(quotesQuery),
    enabled: !!selectedSinId,
  });
  const quotes = quotesResult?.data ?? [];

  // ── Row states (score + note per quote) ──────────────────────────────────
  const [rows, setRows] = useState<Record<string, LinkRowState>>({});

  function getRow(quoteId: string): LinkRowState {
    return rows[quoteId] ?? { quoteId, score: 60, note: '', selected: false };
  }

  function updateRow(quoteId: string, patch: Partial<LinkRowState>) {
    setRows((prev) => ({
      ...prev,
      [quoteId]: { ...getRow(quoteId), ...patch },
    }));
  }

  const selectedRows = useMemo(
    () => quotes.filter((q) => getRow(q.id).selected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotes, rows],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: linkOne, isPending: isLinking } = useAdminLinkSinQuote();
  const { mutate: bulkLink, isPending: isBulking } = useAdminBulkLinkSinQuotes();

  function handleLink(quoteId: string) {
    const row = getRow(quoteId);
    linkOne({
      sinId: selectedSinId,
      quoteId,
      relevanceScore: row.score,
      note: row.note || undefined,
    });
  }

  function handleBulk() {
    if (!selectedSinId || selectedRows.length === 0) return;
    bulkLink({
      sinId: selectedSinId,
      links: selectedRows.map((q) => {
        const row = getRow(q.id);
        return {
          quoteId: q.id,
          relevanceScore: row.score,
          note: row.note || undefined,
        };
      }),
    });
  }

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: ColumnDef<QuoteDto>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          aria-label={t('linking.selectAll')}
          className="rounded border border-input"
          onChange={(e) => {
            const checked = e.target.checked;
            quotes.forEach((q) => updateRow(q.id, { selected: checked }));
          }}
        />
      ),
      cell: (row) => (
        <input
          type="checkbox"
          checked={getRow(row.id).selected}
          aria-label={t('linking.selectRow')}
          className="rounded border border-input"
          onChange={(e) => updateRow(row.id, { selected: e.target.checked })}
        />
      ),
      className: 'w-10',
    },
    {
      key: 'text',
      header: t('quotes.colText'),
      cell: (row) => (
        <ArabicText as="p" size="sm" className="line-clamp-2 max-w-xs">
          {row.textAr}
        </ArabicText>
      ),
    },
    {
      key: 'grade',
      header: t('quotes.colGrade'),
      cell: (row) =>
        row.hadith?.grade ? (
          <GradeBadge grade={row.hadith.grade} label={row.hadith.grade} />
        ) : null,
    },
    {
      key: 'score',
      header: t('linking.relevanceScore'),
      cell: (row) => (
        <ScoreSelect
          value={getRow(row.id).score}
          onChange={(v) => updateRow(row.id, { score: v })}
        />
      ),
    },
    {
      key: 'note',
      header: t('linking.note'),
      cell: (row) => (
        <Input
          value={getRow(row.id).note}
          onChange={(e) => updateRow(row.id, { note: e.target.value })}
          placeholder={t('linking.notePlaceholder')}
          className="h-8 w-40 text-sm"
          aria-label={t('linking.note')}
          maxLength={1000}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        linkedIds.has(row.id) ? (
          <Badge variant="outline" className="whitespace-nowrap text-xs text-muted-foreground">
            {t('linking.alreadyLinked')}
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={isLinking}
            onClick={() => handleLink(row.id)}
            aria-label={t('linking.link')}
          >
            <Link2 className="me-1 h-3.5 w-3.5" aria-hidden />
            {t('linking.link')}
          </Button>
        )
      ),
      className: 'whitespace-nowrap',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('linking.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('linking.subtitle')}</p>
      </div>

      {/* Sin picker */}
      <div className="flex flex-col gap-2">
        <label htmlFor="sin-select" className="text-sm font-medium">
          {t('linking.pickSin')}
        </label>
        <Select value={selectedSinId} onValueChange={setSelectedSinId}>
          <SelectTrigger id="sin-select" className="w-72">
            <SelectValue placeholder={t('linking.selectSin')} />
          </SelectTrigger>
          <SelectContent>
            {sins.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span dir="rtl" lang="ar" className="font-arabic-ui">{s.nameAr}</span>
                {' '}
                <span className="text-muted-foreground">({s.quoteCount})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSin && (
        <>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArabicText as="h2" size="base" className="font-medium">
                {selectedSin.nameAr}
              </ArabicText>
              <Badge variant="outline">{selectedSin.quoteCount} linked</Badge>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                placeholder={t('linking.searchQuotes')}
                className="w-48"
                aria-label={t('linking.searchQuotes')}
              />
              {selectedRows.length > 0 && (
                <Button
                  size="sm"
                  disabled={isBulking}
                  onClick={handleBulk}
                >
                  {t('linking.bulkLink', { count: selectedRows.length })}
                </Button>
              )}
            </div>
          </div>

          <AdminDataTable
            columns={columns}
            data={quotes}
            isLoading={quotesLoading}
            emptyMessage={t('linking.noQuotes')}
            rowKey={(r) => r.id}
          />
        </>
      )}

      {!selectedSinId && (
        <p className="py-12 text-center text-muted-foreground">{t('linking.emptySin')}</p>
      )}
    </div>
  );
}
