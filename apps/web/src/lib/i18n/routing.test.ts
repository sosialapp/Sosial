import { describe, expect, it } from 'vitest';
import { hreflangAlternates, isLocalizedPath, localizedPath, splitLocalePath } from './routing';

describe('locale routing', () => {
  it('splits a locale prefix off the path', () => {
    expect(splitLocalePath('/es')).toEqual({ locale: 'es', path: '/' });
    expect(splitLocalePath('/es/')).toEqual({ locale: 'es', path: '/' });
    expect(splitLocalePath('/ja/pricing')).toEqual({ locale: 'ja', path: '/pricing' });
  });

  it('leaves unprefixed and look-alike paths alone', () => {
    expect(splitLocalePath('/pricing')).toEqual({ locale: null, path: '/pricing' });
    expect(splitLocalePath('/delete-data')).toEqual({ locale: null, path: '/delete-data' });
    expect(splitLocalePath('/xx/pricing')).toEqual({ locale: null, path: '/xx/pricing' });
  });

  it('prefixes only translated pages, never English', () => {
    expect(localizedPath('/', 'en')).toBe('/');
    expect(localizedPath('/', 'fr')).toBe('/fr');
    expect(localizedPath('/pricing', 'de')).toBe('/de/pricing');
    expect(localizedPath('/blog', 'de')).toBe('/blog');
    expect(isLocalizedPath('/features')).toBe(true);
    expect(isLocalizedPath('/about')).toBe(false);
  });

  it('lists every locale plus x-default in hreflang', () => {
    const alt = hreflangAlternates('/pricing', 'https://sosial.app');
    expect(alt['x-default']).toBe('https://sosial.app/pricing');
    expect(alt.en).toBe('https://sosial.app/pricing');
    expect(alt['zh-Hans']).toBe('https://sosial.app/zh/pricing');
    expect(Object.keys(alt)).toHaveLength(8);
  });
});
