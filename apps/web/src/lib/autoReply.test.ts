import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE,
  matchesKeyword,
  matchesKeywords,
  renderTemplate,
  validateRuleInput,
} from './autoReply';

describe('matchesKeyword', () => {
  it('matches the word itself but not words built on it', () => {
    expect(matchesKeyword('what is the price?', 'price')).toBe(true);
    expect(matchesKeyword('the PRICE please', 'price')).toBe(true);
    expect(matchesKeyword('pricing info', 'price')).toBe(false);
    expect(matchesKeyword('pricey', 'price')).toBe(false);
  });

  it('respects exact and contains modes', () => {
    expect(matchesKeyword('  Price ', 'price', 'exact')).toBe(true);
    expect(matchesKeyword('the price', 'price', 'exact')).toBe(false);
    expect(matchesKeyword('pricing', 'pric', 'contains')).toBe(true);
    expect(matchesKeyword('pricing', 'pric', 'word')).toBe(false);
  });
});

describe('matchesKeywords', () => {
  const keywords = ['price', 'shipping'];
  it('supports any and all', () => {
    expect(matchesKeywords('price?', keywords)).toBe(true);
    expect(matchesKeywords('price and shipping', keywords, 'word', 'all')).toBe(true);
    expect(matchesKeywords('price only', keywords, 'word', 'all')).toBe(false);
  });
});

describe('renderTemplate', () => {
  it('renders known variables and drops unknown ones', () => {
    expect(renderTemplate('Hi {{name}} from {{platform}}{{nope}}', { name: 'Ana', platform: 'x' })).toBe(
      'Hi Ana from X',
    );
  });
});

describe('validateRuleInput', () => {
  it('accepts the default rule shape with a name, keyword and reply', () => {
    const res = validateRuleInput({
      ...DEFAULT_RULE,
      name: 'Price list',
      keywords: ['price'],
      reply_text: 'Hey {{name}}, here is the price list.',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.keywords).toEqual(['price']);
      expect(res.value.match_mode).toBe('word');
    }
  });

  it('requires a name, a keyword and a reply', () => {
    expect(validateRuleInput({ ...DEFAULT_RULE, keywords: ['price'], reply_text: 'x' }).ok).toBe(false);
    expect(validateRuleInput({ ...DEFAULT_RULE, name: 'x', reply_text: 'x' }).ok).toBe(false);
    expect(validateRuleInput({ ...DEFAULT_RULE, name: 'x', keywords: ['price'] }).ok).toBe(false);
  });

  it('clamps numbers into the DB ranges', () => {
    const res = validateRuleInput({
      ...DEFAULT_RULE,
      name: 'Caps',
      keywords: ['price'],
      reply_text: 'ok',
      daily_cap: 99999,
      delay_seconds: -5,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.daily_cap).toBe(1000);
      expect(res.value.delay_seconds).toBe(0);
    }
  });

  it('dedupes keywords case-insensitively', () => {
    const res = validateRuleInput({
      ...DEFAULT_RULE,
      name: 'Dedupe',
      keywords: ['Price', 'price', ' price ', 'shipping'],
      reply_text: 'ok',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.keywords).toEqual(['Price', 'shipping']);
  });
});
