/**
 * «لحظة الضعف»: the in-memory hand-off, the moment's text (published evidence only, turning day by day), the
 * catalog's evidence union, and the check-back notification (generic words only, its own source).
 */

const mockSchedule = jest.fn(async (_request: unknown) => 'id');
const mockCancel = jest.fn(async (_id: string) => undefined);
const mockEnsurePermission = jest.fn(async (_channel: string) => true);

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (request: unknown) => mockSchedule(request),
  cancelScheduledNotificationAsync: (id: string) => mockCancel(id),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('../lib/practice/notifications', () => ({
  CHANNEL_ID: 'thekra-reminders',
  ensurePermission: (channel: string) => mockEnsurePermission(channel),
}));

import type { QuoteDto } from '../lib/types/api';
import { allSinProgramEvidenceIds, type SinProgramsCatalog, type UrgeMoment } from '../lib/practice/catalog-types';
import { REMINDER_SOURCE } from '../lib/practice/reminders';
import {
  momentTextIds,
  pickMomentText,
  scheduleUrgeCheckBack,
  setUrgeProgram,
  urgeProgram,
  URGE_CHECKBACK_SOURCE,
} from '../lib/practice/urge-moment';

const text = (titleAr: string, evidence?: string[]) => ({ titleAr, titleEn: titleAr, bodyAr: 'b', bodyEn: 'b', ...(evidence ? { evidence } : {}) });
const urge: UrgeMoment = {
  review: 'pending-sheikh',
  breathe: { ...text('breathe'), breaths: 3 },
  text: text('text', ['verse']),
  move: { ...text('move'), moves: [{ key: 'wudu', titleAr: 'توضأ', titleEn: 'Make wudu' }] },
  delay: { ...text('delay'), minutes: 10 },
  companion: { ...text('companion'), shareAr: 'ادعُ لي بالثبات', shareEn: 'Pray for me' },
  passed: text('passed'),
};
const quote = (id: string) => ({ id }) as QuoteDto;

describe('hand-off', () => {
  it('holds the program in memory until cleared', () => {
    setUrgeProgram('a');
    expect(urgeProgram()).toBe('a');
    setUrgeProgram(null);
    expect(urgeProgram()).toBeNull();
  });
});

describe('the moment\'s text', () => {
  it('puts the step\'s texts before the program\'s, once each', () => {
    expect(momentTextIds(urge, { sin: 's', category: 'haqq_allah', gradualAllowed: true, help: false, evidence: ['p1', 'verse'] })).toEqual(['verse', 'p1']);
    expect(momentTextIds(urge, undefined)).toEqual(['verse']);
  });

  it('shows only published texts and turns through them by day', () => {
    const byId = new Map([['verse', quote('verse')], ['p1', quote('p1')]]);
    const ids = ['verse', 'missing', 'p1'];
    const first = pickMomentText(ids, byId, '2026-10-29');
    const next = pickMomentText(ids, byId, '2026-10-30');
    expect([first?.id, next?.id].sort()).toEqual(['p1', 'verse']);
    expect(pickMomentText(['missing'], byId, '2026-10-29')).toBeNull();
    expect(pickMomentText(ids, undefined, '2026-10-29')).toBeNull();
  });

  it('is part of the one evidence request for all programs', () => {
    const catalog = {
      review: 'pending-sheikh',
      common: {
        willQuestionAr: '',
        willQuestionEn: '',
        stageMinDays: 7,
        stages: {},
        afterFall: text('fall', ['f']),
        urgeMoment: urge,
        followWithGood: {
          review: 'pending-sheikh',
          istighfar: { ...text('i', ['i1']), lineAr: 'أستغفر الله وأتوب إليه', lineEn: 'x' },
          deeds: { ...text('d', ['d1']), choices: [{ key: 'dhikr', titleAr: 'ذكر', titleEn: 'Dhikr', evidence: ['c1'] }] },
          close: text('c', ['z']),
        },
        helpAr: '',
        helpEn: '',
      },
      programs: [{ sin: 's', category: 'haqq_allah', gradualAllowed: true, help: false, evidence: ['p1'] }],
    } as SinProgramsCatalog;
    expect(allSinProgramEvidenceIds(catalog)).toEqual(['c1', 'd1', 'f', 'i1', 'p1', 'verse', 'z']);
  });
});

describe('scheduleUrgeCheckBack', () => {
  beforeEach(() => jest.clearAllMocks());

  it('schedules one generic notification after the delay, under its own source', async () => {
    expect(await scheduleUrgeCheckBack(10, 'Reminders')).toBe(true);
    expect(mockSchedule).toHaveBeenCalledWith({
      identifier: `${URGE_CHECKBACK_SOURCE}:checkback`,
      content: { body: 'تذكرة من ذكرى', data: { source: URGE_CHECKBACK_SOURCE } },
      trigger: { type: 'timeInterval', seconds: 600, channelId: 'thekra-reminders' },
    });
    expect(URGE_CHECKBACK_SOURCE).not.toBe(REMINDER_SOURCE);
  });

  it('does nothing without permission, and never throws', async () => {
    mockEnsurePermission.mockResolvedValueOnce(false);
    expect(await scheduleUrgeCheckBack(10, 'Reminders')).toBe(false);
    expect(mockSchedule).not.toHaveBeenCalled();
    mockSchedule.mockRejectedValueOnce(new Error('x'));
    expect(await scheduleUrgeCheckBack(10, 'Reminders')).toBe(false);
  });
});
