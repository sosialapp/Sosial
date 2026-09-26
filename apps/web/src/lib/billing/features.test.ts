import { describe, expect, it } from 'vitest';
import { FEATURE_MATRIX, FEATURE_PLAN_ORDER } from './features';
import { PLANS, PLAN_ORDER } from './plans';

function row(label: string) {
  for (const cat of FEATURE_MATRIX) {
    const found = cat.rows.find((r) => r.label === label);
    if (found) return found;
  }
  throw new Error(`row not found: ${label}`);
}

describe('FEATURE_MATRIX', () => {
  it('exposes exactly the canonical plans, in order', () => {
    expect(FEATURE_PLAN_ORDER).toEqual(PLAN_ORDER);
  });

  it('derives limit rows from PLANS so the table cannot drift', () => {
    expect(row('Connected channels').value('free')).toBe('3 channels');
    expect(row('Connected channels').value('business')).toBe('100 channels');
    expect(row('Scheduled posts per channel').value('solo')).toBe('50 posts');
    expect(row('AI credits per month').value('team')).toBe('1,500 credits');
    expect(row('Team members').value('free')).toBe('1 member');
    expect(row('Workspaces / brands').value('business')).toBe('10 workspaces');
  });

  it('marks the watermark as required on free and user-controlled when paid', () => {
    expect(row('Sosial watermark').value('free')).toBe('Required');
    for (const key of PLAN_ORDER.filter((k) => k !== 'free')) {
      expect(row('Sosial watermark').value(key)).toBe('You control it');
    }
    expect(PLANS.free.limits.watermarkRequired).toBe(true);
  });

  it('gates bulk scheduling and brand voice to the right plans', () => {
    expect(row('Bulk scheduling').value('free')).toBe(false);
    expect(row('Bulk scheduling').value('solo')).toBe(true);
    expect(row('Brand voice training').value('team')).toBe(false);
    expect(row('Brand voice training').value('business')).toBe(true);
  });
});
