/**
 * Sample workspace for the marketing previews: a small studio with five
 * connected accounts and a believable month of posts. Dates are built
 * relative to "now" so the calendar always shows a live-looking month.
 * Client-only (the previews mount after hydration), so Date.now() is safe.
 */

import type { ConnectedChannel, PostWithTargets } from '@/lib/types';

const PROVIDERS = ['instagram', 'x', 'tiktok', 'linkedin', 'facebook', 'threads'] as const;

export const SAMPLE_CHANNELS: ConnectedChannel[] = PROVIDERS.map((p, i) => ({
  id: `sample-ch-${i}`,
  workspace_id: 'sample',
  provider: p,
  external_id: `sample-${p}`,
  display_name: 'Northwind Coffee',
  handle: 'northwind.coffee',
  instance_url: null,
  status: 'connected' as ConnectedChannel['status'],
  metadata: {},
}));

const CAPTIONS = [
  'New single-origin from Huila lands Friday. Bright, red apple, panela.',
  'Behind the bar: how we dial in espresso every morning',
  'Weekly roundup: 5 things we brewed, broke and learned',
  'Meet Ana, our head roaster, in 60 seconds',
  'Pour-over guide: 15g coffee, 250g water, 3 minutes',
  'Customer spotlight: the café that ships to 12 countries',
  'Autumn menu is live. Maple oat latte is back.',
  'Thread: what “natural process” actually means',
];

/** Day offsets from today and an hour for each sample post. */
const PLAN: [number, number, number][] = [
  [-19, 9, 0], [-14, 12, 30], [-11, 8, 15], [-8, 17, 0], [-6, 10, 45], [-4, 13, 0], [-2, 9, 30], [-1, 16, 0],
  [0, 9, 0], [0, 12, 30], [0, 18, 0], [1, 10, 0], [2, 8, 30], [2, 15, 0], [3, 11, 0], [5, 9, 15],
  [6, 17, 30], [8, 10, 0], [9, 14, 0], [12, 9, 0], [15, 11, 30], [18, 10, 0],
];

export function samplePosts(): PostWithTargets[] {
  const now = new Date();
  return PLAN.map(([off, h, m], i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, h, m);
    const iso = d.toISOString();
    const ch = SAMPLE_CHANNELS[i % SAMPLE_CHANNELS.length];
    const past = d.getTime() < now.getTime();
    const status = past ? (i === 4 ? 'failed' : 'sent') : i % 5 === 3 ? 'draft' : 'queued';
    return {
      id: `sample-post-${i}`,
      workspace_id: 'sample',
      created_by: null,
      client_id: null,
      title: '',
      body: CAPTIONS[i % CAPTIONS.length],
      status: status as PostWithTargets['status'],
      scheduled_at: iso,
      timezone: null,
      chain_id: null,
      chain_position: 0,
      created_at: iso,
      updated_at: iso,
      sent_at: status === 'sent' ? iso : null,
      post_targets: [
        {
          id: `sample-t-${i}`,
          post_id: `sample-post-${i}`,
          channel_id: ch.id,
          provider: ch.provider,
          format: null,
          caption: null,
          options: {},
          status: (status === 'sent' ? 'sent' : 'queued') as PostWithTargets['post_targets'][number]['status'],
          scheduled_at: iso,
          remote_id: null,
          remote_url: null,
          attempts: 0,
          last_error: null,
          sent_at: null,
          idempotency_key: `sample-${i}`,
        },
      ],
      post_media: [],
    };
  });
}

export const SAMPLE_TEAM = {
  members: [
    { id: 'sm1', user_id: 'su1', email: 'ana@northwind.coffee', role: 'owner' as const, all_channels: true },
    { id: 'sm2', user_id: 'su2', email: 'leo@northwind.coffee', role: 'admin' as const, all_channels: true },
    { id: 'sm3', user_id: 'su3', email: 'mira@northwind.coffee', role: 'member' as const, all_channels: false },
    { id: 'sm4', user_id: 'su4', email: 'studio@agency.co', role: 'member' as const, all_channels: false },
  ],
  invites: [
    {
      id: 'si1',
      email: 'new.barista@northwind.coffee',
      role: 'member' as const,
      all_channels: true,
      expires_at: null,
      token: 'sample',
      emailed_at: '2026-01-01T00:00:00Z',
    },
  ],
  grants: [
    { member_id: 'sm3', provider: 'instagram' },
    { member_id: 'sm3', provider: 'tiktok' },
    { member_id: 'sm4', provider: 'linkedin' },
  ],
  channels: SAMPLE_CHANNELS.slice(0, 4).map((c) => ({
    provider: c.provider,
    external_id: c.external_id,
    display_name: c.display_name,
    handle: c.handle,
    metadata: {},
  })),
};
