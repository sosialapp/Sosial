import { describe, expect, it } from 'vitest';
import {
  matchesKeyword,
  matchesKeywords,
  pickRule,
  providerCanReply,
  renderTemplate,
  replyLimit,
  type AutoReplyRule,
} from './autoReply';

describe('matchesKeyword', () => {
  it('matches whole words and ignores case', () => {
    expect(matchesKeyword('What is the PRICE?', 'price')).toBe(true);
    expect(matchesKeyword('price', 'Price')).toBe(true);
    expect(matchesKeyword('send me the price-list', 'price')).toBe(true);
  });

  it('does not match words that merely contain the keyword', () => {
    expect(matchesKeyword('I love your pricing', 'price')).toBe(false);
    expect(matchesKeyword('that was pricey', 'price')).toBe(false);
    expect(matchesKeyword('prices please', 'price')).toBe(false);
  });

  it('handles punctuation, emoji and unicode boundaries', () => {
    expect(matchesKeyword('price 🙏', 'price')).toBe(true);
    expect(matchesKeyword('(price)', 'price')).toBe(true);
    expect(matchesKeyword('prix', 'price')).toBe(false);
    expect(matchesKeyword('précio price', 'price')).toBe(true);
  });

  it('matches multi-word phrases with flexible whitespace', () => {
    expect(matchesKeyword('what is   the  price?', 'the price')).toBe(true);
    expect(matchesKeyword('thepricelist', 'the price')).toBe(false);
  });

  it('supports contains for partial matches', () => {
    expect(matchesKeyword('pricing info', 'pric', 'contains')).toBe(true);
    expect(matchesKeyword('pricing info', 'pric', 'word')).toBe(false);
  });

  it('supports exact for whole-message matches', () => {
    expect(matchesKeyword('  price ', 'price', 'exact')).toBe(true);
    expect(matchesKeyword('price?', 'price', 'exact')).toBe(false);
    expect(matchesKeyword('the price', 'price', 'exact')).toBe(false);
  });

  it('never matches an empty keyword or empty body', () => {
    expect(matchesKeyword('price', '')).toBe(false);
    expect(matchesKeyword('', 'price')).toBe(false);
    expect(matchesKeyword(null, 'price')).toBe(false);
  });
});

describe('matchesKeywords', () => {
  it('matches any keyword by default', () => {
    expect(matchesKeywords('do you do shipping to Canada?', ['price', 'shipping'])).toBe(true);
    expect(matchesKeywords('hello there', ['price', 'shipping'])).toBe(false);
  });

  it('matches all keywords when asked', () => {
    expect(matchesKeywords('price and shipping?', ['price', 'shipping'], 'word', 'all')).toBe(true);
    expect(matchesKeywords('price only', ['price', 'shipping'], 'word', 'all')).toBe(false);
  });

  it('treats an empty list as no match', () => {
    expect(matchesKeywords('price', [])).toBe(false);
    expect(matchesKeywords('price', ['  ', ''])).toBe(false);
  });
});

describe('renderTemplate', () => {
  it('fills the known variables', () => {
    expect(
      renderTemplate('Hi {{name}}, the price is on the site. {{platform}}', {
        name: 'Ana Souza',
        platform: 'instagram',
      }),
    ).toBe('Hi Ana Souza, the price is on the site. Instagram');
  });

  it('supports first name and handle aliases', () => {
    expect(
      renderTemplate('{{first_name}} / {{handle}} / {{username}}', { name: 'Ana Souza' }),
    ).toBe('Ana / Ana Souza / Ana Souza');
  });

  it('strips unknown placeholders instead of leaking them publicly', () => {
    expect(renderTemplate('Hi {{name}} {{nope}}', { name: 'Ana' })).toBe('Hi Ana');
  });

  it('preserves line breaks and emoji', () => {
    expect(renderTemplate('Hi {{name}} 💛\n\nPrice list: /shop', { name: 'Ana' })).toBe(
      'Hi Ana 💛\n\nPrice list: /shop',
    );
  });
});

describe('provider support', () => {
  it('knows comment and DM surfaces', () => {
    expect(providerCanReply('comment', 'youtube')).toBe(true);
    expect(providerCanReply('comment', 'linkedin')).toBe(false);
    expect(providerCanReply('message', 'instagram')).toBe(true);
    expect(providerCanReply('message', 'youtube')).toBe(false);
  });

  it('uses the platform reply limits', () => {
    expect(replyLimit('comment', 'x')).toBe(280);
    expect(replyLimit('comment', 'threads')).toBe(500);
    expect(replyLimit('comment', 'unknown')).toBe(2000);
  });
});

function rule(over: Partial<AutoReplyRule>): AutoReplyRule {
  return {
    id: over.id ?? 'rule-1',
    workspace_id: 'ws-1',
    name: over.name ?? 'Price',
    enabled: true,
    dry_run: false,
    scope: 'comments',
    channel_id: null,
    match_mode: 'word',
    keywords: ['price'],
    keyword_mode: 'any',
    reply_text: 'Hi {{name}}, our price list is at /shop.',
    delay_seconds: 60,
    max_age_minutes: 60,
    daily_cap: 50,
    per_post_cap: 20,
    cooldown_minutes: 1440,
    first_reply_only: false,
    escalate_keywords: [],
    priority: 0,
    ...over,
  };
}

describe('pickRule', () => {
  it('returns null when nothing matches', () => {
    expect(pickRule([rule({})], 'love this post', 'ch-1')).toBeNull();
  });

  it('matches exact wording when configured', () => {
    const r = rule({ match_mode: 'exact' });
    expect(pickRule([r], 'price', 'ch-1')?.rule.id).toBe('rule-1');
    expect(pickRule([r], 'what is the price', 'ch-1')).toBeNull();
  });

  it('respects the channel filter', () => {
    const r = rule({ channel_id: 'ch-2' });
    expect(pickRule([r], 'price', 'ch-1')).toBeNull();
    expect(pickRule([r], 'price', 'ch-2')?.rule.id).toBe('rule-1');
  });

  it('prefers the higher-priority rule', () => {
    const low = rule({ id: 'low', priority: 0 });
    const high = rule({ id: 'high', priority: 10 });
    expect(pickRule([high, low], 'price', 'ch-1')?.rule.id).toBe('high');
  });

  it('lets escalation keywords win over a keyword match', () => {
    const r = rule({ escalate_keywords: ['refund'] });
    expect(pickRule([r], 'price and refund please', 'ch-1')).toEqual({
      rule: r,
      escalated: true,
    });
    expect(pickRule([r], 'price please', 'ch-1')).toEqual({ rule: r, escalated: false });
  });
});
