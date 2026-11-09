'use client';

import { useId, useState } from 'react';
import { MailOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  addSelfMessage,
  editSelfMessage,
  removeSelfMessage,
  SELF_MESSAGE_MAX_LENGTH,
  SELF_MESSAGES_MAX,
  selfMessageError,
  selfMessages,
  type SelfMessage,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDigits } from '@/lib/format/digits';
import { formatDateTime } from '@/lib/practice/format';
import { updateHeart } from '@/lib/practice/heart-store';
import { newUuid } from '@/lib/practice/ids';
import { useHeart } from '../../hooks/useHeart';

/**
 * «رسائلي إلى نفسي» (round 6, C-02c): a button at the top of «عاداتي» opening the member's own list — add, edit, delete,
 * at most 10 (practice-core `SELF_MESSAGES_MAX`). Device-local heart data (never sent). After a save: a toast, back to
 * the list. Delete asks first.
 */
export function SelfMessagesButton() {
  const t = useTranslations('practice.selfMessages');
  const heart = useHeart();
  const [open, setOpen] = useState(false);
  const count = heart?.messages?.length ?? 0;
  return (
    <>
      <Button variant="outline" tone="primary" size="sm" icon={<MailOpen aria-hidden />} onClick={() => setOpen(true)} disabled={!heart}>
        {t('button')}
        {count > 0 ? <span className="text-xs tabular-nums text-muted-foreground">{formatDigits(count)}</span> : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{t('title')}</DialogTitle>
            <DialogDescription className="leading-7">{t('lead', { max: formatDigits(SELF_MESSAGES_MAX) })}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pe-1">{open && heart ? <SelfMessagesList list={selfMessages(heart)} /> : null}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SelfMessagesList({ list }: { list: SelfMessage[] }) {
  const t = useTranslations('practice.selfMessages');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const [editing, setEditing] = useState<string | 'new' | null>(list.length === 0 ? 'new' : null);
  const [removing, setRemoving] = useState<SelfMessage | null>(null);
  const full = list.length >= SELF_MESSAGES_MAX;
  return (
    <div className="flex flex-col gap-4">
      {editing === 'new' ? (
        <MessageForm
          onCancel={list.length > 0 ? () => setEditing(null) : undefined}
          onSave={(text) => {
            updateHeart((h) => addSelfMessage(h, { id: newUuid(), text }));
            toast.success(t('added'));
            setEditing(null);
          }}
        />
      ) : full ? (
        <p className="text-sm leading-7 text-muted-foreground">{t('full', { max: formatDigits(SELF_MESSAGES_MAX) })}</p>
      ) : (
        <Button variant="outline" tone="primary" className="self-start" icon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
          {t('add')}
        </Button>
      )}
      {list.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {list.map((m) =>
            editing === m.id ? (
              <li key={m.id} className="py-3">
                <MessageForm
                  initial={m.text}
                  id={m.id}
                  onCancel={() => setEditing(null)}
                  onSave={(text) => {
                    updateHeart((h) => editSelfMessage(h, m.id, text));
                    toast.success(t('saved'));
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={m.id} className="flex items-start gap-2 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-base leading-8 break-words whitespace-pre-line">{m.text}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(m.updatedAt, locale)}</p>
                </div>
                <Button variant="ghost" tone="primary" size="sm" iconOnly icon={<Pencil aria-hidden />} aria-label={t('edit')} onClick={() => setEditing(m.id)} />
                <Button variant="ghost" tone="destructive" size="sm" iconOnly icon={<Trash2 aria-hidden />} aria-label={t('remove')} onClick={() => setRemoving(m)} />
              </li>
            ),
          )}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('count', { n: formatDigits(list.length), max: formatDigits(SELF_MESSAGES_MAX) })}</p>
      <AlertDialog open={removing !== null} onOpenChange={(next) => (next ? undefined : setRemoving(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="break-words">{removing?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <ActionPair>
              <Button
                tone="destructive"
                onClick={() => {
                  if (removing) updateHeart((h) => removeSelfMessage(h, removing.id));
                  setRemoving(null);
                  toast.success(t('removed'));
                }}
              >
                {t('removeConfirm')}
              </Button>
              <Button variant="outline" tone="neutral" onClick={() => setRemoving(null)}>
                {t('keep')}
              </Button>
            </ActionPair>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** One message's field: a short text (≤ 280), «احفظ» and «إلغاء» as one pair. */
export function MessageForm({
  initial = '',
  id,
  onSave,
  onCancel,
  saveLabel,
}: {
  initial?: string;
  id?: string;
  onSave: (text: string) => void;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const t = useTranslations('practice.selfMessages');
  const heart = useHeart();
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium">
        {t('field')}
      </label>
      <Textarea
        id={fieldId}
        value={text}
        maxLength={SELF_MESSAGE_MAX_LENGTH}
        rows={3}
        placeholder={t('placeholder')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ActionPair className="sm:max-w-sm">
        <Button
          onClick={() => {
            const err = heart ? selfMessageError(heart, text, id) : 'empty';
            if (err) {
              setError(t(`errors.${err}`, { max: formatDigits(SELF_MESSAGES_MAX) }));
              return;
            }
            onSave(text);
          }}
        >
          {saveLabel ?? t('save')}
        </Button>
        {onCancel ? (
          <Button variant="outline" tone="neutral" onClick={onCancel}>
            {t('cancel')}
          </Button>
        ) : null}
      </ActionPair>
    </div>
  );
}
