'use client';

import { useTranslations } from 'next-intl';
import type { ProvenanceTrailLabels } from './ProvenanceTrail';

/** Localised labels for ProvenanceTrail (kept out of the presentational component). */
export function useTrailLabels(): ProvenanceTrailLabels {
  const t = useTranslations('admin.trail');
  return {
    title: t('label'),
    failHere: t('failHere'),
    states: {
      ok: t('stateOk'),
      warn: t('stateWarn'),
      fail: t('stateFail'),
      na: t('stateNa'),
      pending: t('statePending'),
    },
  };
}
