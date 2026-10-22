import { afterEach, describe, expect, it, vi } from 'vitest';
import { facebook } from './facebook';
import { instagram } from './instagram';

const realFetch = globalThis.fetch;

const fb = {
  id: 'c1', workspaceId: 'w1', provider: 'facebook', externalId: '123',
  instanceUrl: null, displayId: 'Global Fiat', token: 'fb-token',
};
const ig = {
  id: 'c2', workspaceId: 'w1', provider: 'instagram', externalId: '987',
  instanceUrl: null, displayId: '@globalfiat', token: 'ig-token',
};

function stub(payload: unknown, status = 200) {
  return stubRoutes(() => [payload, status]);
}

function stubRoutes(handler: (url: string) => [unknown, number?]) {
  const calls: { url: string; init: any }[] = [];
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    const [payload, status = 200] = handler(String(url));
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('facebook adapter', () => {
  it('uses the Send API with recipient.id and messaging_type', async () => {
    const calls = stub({ message_id: 'm_1', recipient_id: 'psid-9' });
    const res = await facebook.sendMessage(fb, 'conv-1', { text: 'hello' }, 'psid-9');
    expect(res.externalId).toBe('m_1');
    expect(calls[0].url).toBe('https://graph.facebook.com/v21.0/123/messages');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({
      recipient: { id: 'psid-9' },
      messaging_type: 'RESPONSE',
      message: { text: 'hello' },
    });
  });

  it('refuses to send without the Messenger user id', async () => {
    stub({});
    await expect(facebook.sendMessage(fb, 'conv-1', { text: 'hi' }, null)).rejects.toThrow(
      /no Messenger user id/,
    );
  });

  it('enumerates own posts with comment counts', async () => {
    stub({ data: [{ id: 'p1', comments: { summary: { total_count: 4 } } }] });
    await expect(facebook.listOwnPosts?.(fb, 10)).resolves.toEqual([
      { externalId: 'p1', commentCount: 4 },
    ]);
  });
});

describe('instagram adapter', () => {
  it('asks conversations only for documented fields and keeps the IGSID', async () => {
    const me = { id: '987', user_id: '17841458653207334', username: 'globalfiat' };
    const calls = stubRoutes((url) =>
      url.includes('/me?')
        ? [me]
        : [{
            data: [{
              id: 't_1',
              updated_time: '1729000000',
              participants: {
                data: [
                  { id: '17841458653207334', username: 'globalfiat' },
                  { id: '555', username: 'fan' },
                ],
              },
            }],
          }],
    );
    const page = await instagram.listConversations({ ...ig, externalId: '986' }, null);
    const conv = calls.find((c) => c.url.includes('/conversations'));
    expect(conv?.url).not.toMatch(/unread_count|snippet|message_count/);
    expect(page.items[0]).toMatchObject({
      externalId: 't_1',
      participantExternalId: '555',
      participantName: '@fan',
      unreadCount: 0,
      lastMessageAt: '2024-10-15T13:46:40.000Z',
    });
  });

  it('sends to recipient.id, never a conversation id', async () => {
    const calls = stub({ message_id: 'ig_m1' });
    await instagram.sendMessage(ig, 't_1', { text: 'hi' }, '555');
    expect(calls[0].url).toBe('https://graph.instagram.com/v23.0/987/messages');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.recipient).toEqual({ id: '555' });
    expect(body.recipient.conversation_id).toBeUndefined();
  });

  it('normalizes Instagram attachment shapes and both directions', async () => {
    stubRoutes((url) =>
      url.includes('/me?')
        ? [{ id: '988', user_id: '17841400000000001', username: 'globalfiat' }]
        : [{
            data: [
              {
                id: 'm1',
                created_time: '2024-10-15T14:26:40+0000',
                from: { id: '555', username: 'fan' },
                message: '',
                attachments: { data: [{ image_data: { url: 'https://cdn.example/a.jpg' } }] },
              },
              {
                id: 'm2',
                created_time: '2024-10-15T14:27:40+0000',
                from: { id: '17841400000000001', username: 'globalfiat' },
                message: 'reply',
              },
            ],
          }],
    );
    const page = await instagram.listMessages({ ...ig, externalId: '988' }, 't_1', null);
    expect(page.items.map((m) => m.direction)).toEqual(['out', 'in']);
    expect(page.items.find((m) => m.externalId === 'm1')?.attachments).toEqual([
      { url: 'https://cdn.example/a.jpg' },
    ]);
  });

  it('enumerates own media with comment counts', async () => {
    stub({ data: [{ id: 'media_1', comments_count: 2 }] });
    await expect(instagram.listOwnPosts?.(ig, 10)).resolves.toEqual([
      { externalId: 'media_1', commentCount: 2 },
    ]);
  });
});
