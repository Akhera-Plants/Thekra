'use client';

/**
 * TranslationEditor — inline translation management on quote detail.
 * Upsert (PUT) or delete a translation for a given language code.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminUpsertTranslation, useAdminDeleteTranslation } from '../hooks/useAdminQuotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import type { QuoteDetailDto } from '@/lib/types/api';

interface TranslationEditorProps {
  quoteId: string;
  allTranslations?: QuoteDetailDto['allTranslations'];
}

interface EditState {
  languageCode: string;
  text: string;
}

export function TranslationEditor({ quoteId, allTranslations = [] }: TranslationEditorProps) {
  const t = useTranslations('admin');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLang, setNewLang] = useState('en');
  const [newText, setNewText] = useState('');

  const { mutate: upsert, isPending: isSaving } = useAdminUpsertTranslation(quoteId);
  const { mutate: remove, isPending: isRemoving } = useAdminDeleteTranslation(quoteId);

  function startEdit(lang: string, text: string) {
    setEditing({ languageCode: lang, text });
    setAdding(false);
  }

  function cancelEdit() {
    setEditing(null);
  }

  function saveEdit() {
    if (!editing) return;
    upsert(
      { languageCode: editing.languageCode, text: editing.text },
      { onSuccess: () => setEditing(null) },
    );
  }

  function saveNew() {
    if (!newLang || !newText) return;
    upsert(
      { languageCode: newLang, text: newText },
      {
        onSuccess: () => {
          setAdding(false);
          setNewLang('en');
          setNewText('');
        },
      },
    );
  }

  return (
    <section aria-label={t('translations.sectionLabel')} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('translations.heading')}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setAdding(true); setEditing(null); }}
          aria-label={t('translations.addNew')}
        >
          <Plus className="me-2 h-4 w-4" aria-hidden />
          {t('translations.addNew')}
        </Button>
      </div>

      {allTranslations.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">{t('translations.noTranslations')}</p>
      )}

      <ul className="flex flex-col gap-3" role="list">
        {allTranslations.map(({ languageCode, text }) => (
          <li key={languageCode} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            {editing?.languageCode === languageCode ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`edit-${languageCode}`} className="flex items-center gap-2">
                  <Badge variant="outline">{languageCode}</Badge>
                </Label>
                <textarea
                  id={`edit-${languageCode}`}
                  rows={3}
                  value={editing.text}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={isSaving}>
                    <Check className="me-1 h-3.5 w-3.5" aria-hidden />
                    {isSaving ? t('common.saving') : t('common.save')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="me-1 h-3.5 w-3.5" aria-hidden />
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <Badge variant="outline" className="w-fit">{languageCode}</Badge>
                  <p className="text-sm text-foreground">{text}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={t('common.edit')}
                    onClick={() => startEdit(languageCode, text)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('common.delete')}
                    disabled={isRemoving}
                    onClick={() => {
                      if (window.confirm(t('common.confirmDelete'))) {
                        remove(languageCode);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Add new translation */}
      {adding && (
        <>
          <Separator />
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">{t('translations.newTranslation')}</p>
            <div className="flex items-center gap-2">
              <Label htmlFor="new-lang" className="shrink-0 text-sm">{t('translations.langCode')}</Label>
              <Input
                id="new-lang"
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                placeholder="en"
                className="w-20"
                maxLength={10}
              />
            </div>
            <Label htmlFor="new-text">{t('translations.text')}</Label>
            <textarea
              id="new-text"
              rows={3}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder={t('translations.textPlaceholder')}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveNew} disabled={isSaving || !newLang || !newText}>
                {isSaving ? t('common.saving') : t('translations.save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewText(''); }}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
