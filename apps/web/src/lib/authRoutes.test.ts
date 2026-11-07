import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isGated, needsSession } from './authRoutes';

function routeDirs(group: string): string[] {
  const dir = fileURLToPath(new URL(`../app/${group}`, import.meta.url));
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `/${e.name}`);
}

describe('auth routes', () => {
  it.each(['(app)', '(admin)'])('gates every route in app/%s', (group) => {
    const dirs = routeDirs(group);
    expect(dirs.length).toBeGreaterThan(0);
    expect(dirs.filter((path) => !isGated(path))).toEqual([]);
  });

  it('gates nested paths without matching lookalike names', () => {
    expect(isGated('/community/automations')).toBe(true);
    expect(isGated('/creators')).toBe(false);
    expect(isGated('/importer')).toBe(false);
  });

  it('refreshes the session on invites without gating them', () => {
    const invite = '/invite/7f3c2a10-0000-4000-8000-000000000000';
    expect(needsSession(invite)).toBe(true);
    expect(isGated(invite)).toBe(false);
  });

  it('loads the session on /login but leaves marketing pages alone', () => {
    expect(needsSession('/login')).toBe(true);
    expect(isGated('/login')).toBe(false);
    expect(needsSession('/')).toBe(false);
    expect(needsSession('/pricing')).toBe(false);
  });
});
