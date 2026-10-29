/**
 * The «صحّح السجل» stepper: minutes by 5 (by 1 under 5), counts by 1, inside 0..max.
 */

import { fixLogStep } from '../lib/practice/plan-view';

describe('fixLogStep', () => {
  it('steps minutes by 5 from 5 up, by 1 below', () => {
    expect(fixLogStep(0, 'minutes', 1, 1000)).toBe(1);
    expect(fixLogStep(4, 'minutes', 1, 1000)).toBe(5);
    expect(fixLogStep(5, 'minutes', 1, 1000)).toBe(10);
    expect(fixLogStep(7, 'minutes', 1, 1000)).toBe(10);
    expect(fixLogStep(10, 'minutes', -1, 1000)).toBe(5);
    expect(fixLogStep(7, 'minutes', -1, 1000)).toBe(5);
    expect(fixLogStep(5, 'minutes', -1, 1000)).toBe(4);
    expect(fixLogStep(1, 'minutes', -1, 1000)).toBe(0);
  });

  it('steps counts and times by 1', () => {
    expect(fixLogStep(5, 'count', 1, 1000)).toBe(6);
    expect(fixLogStep(5, 'times', -1, 1000)).toBe(4);
  });

  it('stays inside 0..max', () => {
    expect(fixLogStep(0, 'count', -1, 1000)).toBe(0);
    expect(fixLogStep(998, 'minutes', 1, 1000)).toBe(1000);
  });
});
