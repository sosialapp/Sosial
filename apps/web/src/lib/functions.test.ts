import { describe, expect, it } from 'vitest';
import { edgeErrorMessage } from './functions';

function responseLike(body: unknown): Response {
  return {
    text: async () => JSON.stringify(body),
    json: async () => body,
    clone() {
      return this;
    },
  } as unknown as Response;
}

function textLike(raw: string): Response {
  return {
    text: async () => raw,
  } as unknown as Response;
}

describe('edgeErrorMessage', () => {
  it('digs the server message out of a FunctionsHttpError context', async () => {
    const err = {
      message: 'Edge Function returned a non-2xx status code',
      context: responseLike({ error: "You're out of AI credits for this month." }),
    };
    await expect(edgeErrorMessage(err)).resolves.toBe("You're out of AI credits for this month.");
  });

  it('reads a bare { error } context without text()/json()', async () => {
    await expect(edgeErrorMessage({ context: { error: 'Sign in first.' } })).resolves.toBe(
      'Sign in first.',
    );
  });

  it('surfaces a plain-text (HTML) body trimmed of tags', async () => {
    await expect(
      edgeErrorMessage({ context: textLike('<html><body>Isolate crashed</body></html>') }),
    ).resolves.toBe('Isolate crashed');
  });

  it('returns null when there is no usable message', async () => {
    await expect(edgeErrorMessage(new Error('boom'))).resolves.toBeNull();
    await expect(edgeErrorMessage({ context: responseLike({}) })).resolves.toBeNull();
    await expect(edgeErrorMessage(null)).resolves.toBeNull();
  });
});
