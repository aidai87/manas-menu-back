import { describe, expect, it } from 'vitest';

import { generateId } from '../../public/utils/generateId.js';

describe('generateId', () => {
  it('lowercases ASCII names and replaces spaces with underscores', () => {
    expect(generateId('Pirinc Pilavi')).toBe('pirinc_pilavi');
  });

  it('transliterates Turkish lowercase characters', () => {
    expect(generateId('çğıöşü')).toBe('cgiosu');
  });

  it('transliterates Turkish uppercase İ and dotless I', () => {
    expect(generateId('İZMİR')).toBe('izmir');
    expect(generateId('IZGARA')).toBe('izgara');
  });

  it('handles a real food name end-to-end', () => {
    expect(generateId('Mercimek Çorbası')).toBe('mercimek_corbasi');
  });

  it('collapses runs of non-alphanumerics to a single underscore', () => {
    expect(generateId('Soslu — Bulgur   Pilavı')).toBe('soslu_bulgur_pilavi');
  });

  it('strips leading and trailing underscores', () => {
    expect(generateId('  pilav  ')).toBe('pilav');
    expect(generateId('---pilav---')).toBe('pilav');
  });

  it('preserves digits', () => {
    expect(generateId('Pide 42')).toBe('pide_42');
  });

  it('returns an empty string for input with no alphanumerics', () => {
    expect(generateId('---')).toBe('');
    expect(generateId('   ')).toBe('');
  });

  it('is idempotent: id of an id is the same id', () => {
    const once = generateId('Mercimek Çorbası');
    expect(generateId(once)).toBe(once);
  });

  it('produces stable output for the same input across calls', () => {
    const a = generateId('Tavuk Şnitzel');
    const b = generateId('Tavuk Şnitzel');
    expect(a).toBe(b);
    expect(a).toBe('tavuk_snitzel');
  });
});
