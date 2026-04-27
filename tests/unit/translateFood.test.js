import { describe, expect, it } from 'vitest';

import {
  categoryTranslations,
  translateFood,
  translations,
} from '../../public/utils/translateFood.js';

describe('translateFood', () => {
  it('returns the exact translation when the name is in the dictionary', () => {
    const out = translateFood('Mercimek Çorbası');
    expect(out).toEqual({ ru: 'Чечевичный суп', en: 'Lentil Soup' });
  });

  it('does a partial match when one string contains the other', () => {
    // "Etli Kuru Fasulye" exists; partial includes "Kuru Fasulye"
    const out = translateFood('Kuru Fasulye');
    expect(out).toBeDefined();
    expect(typeof out.ru).toBe('string');
    expect(typeof out.en).toBe('string');
  });

  it('falls back to passing the original Turkish through when nothing matches', () => {
    const out = translateFood('Şipşak Görülmemiş Yemek');
    expect(out).toEqual({
      ru: 'Şipşak Görülmemiş Yemek',
      en: 'Şipşak Görülmemiş Yemek',
    });
  });

  it('is total: never returns null/undefined for any string input', () => {
    const samples = ['', ' ', 'X', 'Pilav', 'çorba', 'unknown'];
    for (const s of samples) {
      const out = translateFood(s);
      expect(out).toBeTruthy();
      expect(out).toHaveProperty('ru');
      expect(out).toHaveProperty('en');
    }
  });

  it('does not mutate the translations dictionary', () => {
    const before = JSON.stringify(translations['Mercimek Çorbası']);
    translateFood('Mercimek Çorbası');
    expect(JSON.stringify(translations['Mercimek Çorbası'])).toBe(before);
  });
});

describe('categoryTranslations', () => {
  it('exposes a map of Turkish category names to {id, title}', () => {
    expect(categoryTranslations['SICAK İÇECEK']).toEqual({
      id: 'hot_drinks',
      title: 'SICAK İÇECEK',
    });
  });

  it('includes both spellings of the breakfast category', () => {
    // The source has both KAHVALTILIKAR (typo) and KAHVALTILIKLAR variants —
    // both must point to the same canonical id so callers do not produce
    // duplicate categories.
    expect(categoryTranslations['KAHVALTILIKAR'].id).toBe('breakfast');
    expect(categoryTranslations['KAHVALTILIKLAR'].id).toBe('breakfast');
  });

  it('every entry has an id that looks like a slug', () => {
    for (const [, value] of Object.entries(categoryTranslations)) {
      expect(value.id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
