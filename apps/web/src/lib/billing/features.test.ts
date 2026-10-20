import { describe, expect, it } from 'vitest';
import { FEATURE_MATRIX, FEATURE_PLAN_ORDER, type FeatureRow } from './features';
import { PLANS, PLAN_ORDER } from './plans';

function row(label: string): FeatureRow {
  for (const cat of FEATURE_MATRIX) {
    const found = cat.rows.find((r) => r.label === label);
    if (found) return found;
  }
  throw new Error(`row not found: ${label}`);
}

/** A num FeatureValue as the old string form, for drift assertions. */
function asText(v: ReturnType<FeatureRow['value']>): unknown {
  if (v.kind === 'num') return `${v.n} ${v.key}`;
  if (v.kind === 'text') return v.key;
  return v.kind === 'ok';
}

describe('FEATURE_MATRIX', () => {
  it('exposes exactly the canonical plans, in order', () => {
    expect(FEATURE_PLAN_ORDER).toEqual(PLAN_ORDER);
  });

  it('derives limit rows from PLANS so the table cannot drift', () => {
    expect(asText(row('pcFChannels').value('free'))).toBe('3 pcNChannels');
    expect(asText(row('pcFChannels').value('business'))).toBe('100 pcNChannels');
    expect(asText(row('pcFSchedPosts').value('free'))).toBe('10 pcNPosts');
    expect(asText(row('pcFSchedPosts').value('solo'))).toBe('pcUnlimited');
    expect(asText(row('pcFSchedPosts').value('team'))).toBe('pcUnlimited');
    expect(asText(row('pcFSchedPosts').value('business'))).toBe('pcUnlimited');
    expect(asText(row('pcFCredits').value('team'))).toBe('1500 pcNCredits');
    expect(asText(row('pcFMembers').value('free'))).toBe('1 pcNMembers');
    expect(asText(row('pcFMembers').value('team'))).toBe('5 pcNMembers');
    expect(asText(row('pcFMembers').value('business'))).toBe('pcUnlimited');
    expect(asText(row('pcFWorkspaces').value('team'))).toBe('3 pcNWorkspaces');
    expect(asText(row('pcFWorkspaces').value('business'))).toBe('6 pcNWorkspaces');
  });

  it('marks the watermark as required on free and user-controlled when paid', () => {
    expect(asText(row('pcFWatermark').value('free'))).toBe('pcWmRequired');
    for (const key of PLAN_ORDER.filter((k) => k !== 'free')) {
      expect(asText(row('pcFWatermark').value(key))).toBe('pcWmControl');
    }
    expect(PLANS.free.limits.watermarkRequired).toBe(true);
  });

  it('gates qualitative capabilities to the right plans', () => {
    expect(row('pcFAdapt').value('free').kind).toBe('no');
    expect(row('pcFAdapt').value('solo').kind).toBe('ok');
    expect(row('pcFApproval').value('solo').kind).toBe('no');
    expect(row('pcFApproval').value('team').kind).toBe('ok');
    expect(row('pcFApproval').value('business').kind).toBe('ok');
    expect(row('pcFClient').value('team').kind).toBe('no');
    expect(row('pcFClient').value('business').kind).toBe('ok');
  });
});
