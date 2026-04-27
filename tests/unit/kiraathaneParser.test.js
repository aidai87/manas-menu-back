import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import nock from 'nock';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { KIRAATHANE_URL } from '../../public/config.js';
import { fetchAndParseKiraathane } from '../../public/parsers/kiraathaneParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/kiraathane.html'),
  'utf-8',
);

const url = new URL(KIRAATHANE_URL);

function mockKiraathane(html = fixture, status = 200) {
  return nock(url.origin).get(url.pathname).reply(status, html, {
    'content-type': 'text/html; charset=utf-8',
  });
}

describe('fetchAndParseKiraathane', () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('returns categories and a meta block', async () => {
    mockKiraathane();
    const out = await fetchAndParseKiraathane();
    expect(out).toMatchObject({
      categories: expect.any(Array),
      meta: expect.objectContaining({
        timezone: 'Asia/Bishkek',
        currency: 'KGS',
        lastUpdated: expect.any(String),
      }),
    });
  });

  it('uses canonical ids from categoryTranslations for known categories', async () => {
    mockKiraathane();
    const { categories } = await fetchAndParseKiraathane();
    const ids = categories.map((c) => c.id);
    expect(ids).toContain('hot_drinks');
    expect(ids).toContain('cold_drinks');
  });

  it('parses items with id, name, and price', async () => {
    mockKiraathane();
    const { categories } = await fetchAndParseKiraathane();
    const hot = categories.find((c) => c.id === 'hot_drinks');
    expect(hot.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cay',
          name: 'ÇAY',
          price: 20,
        }),
        expect.objectContaining({
          id: 'kahve_sade',
          name: 'KAHVE SADE',
          price: 40,
        }),
      ]),
    );
  });

  it('extracts the numeric price even when text contains the currency word', async () => {
    mockKiraathane();
    const { categories } = await fetchAndParseKiraathane();
    const hot = categories.find((c) => c.id === 'hot_drinks');
    const kahve = hot.items.find((i) => i.id === 'kahve_sade');
    expect(kahve.price).toBe(40);
  });

  it('filters out categories that have no items', async () => {
    mockKiraathane();
    const { categories } = await fetchAndParseKiraathane();
    expect(categories.find((c) => c.id === 'yogurts')).toBeUndefined();
  });

  it('generates ids for unknown categories instead of dropping them', async () => {
    mockKiraathane();
    const { categories } = await fetchAndParseKiraathane();
    const unknown = categories.find((c) => c.title === 'UNKNOWN GROUP');
    expect(unknown).toBeDefined();
    expect(unknown.id).toBe('unknown_group');
    expect(unknown.items).toHaveLength(1);
  });

  it('uses CDN photo URLs for ids in buffet_manifest.json', async () => {
    mockKiraathane();
    const { categories } = await fetchAndParseKiraathane();
    const hot = categories.find((c) => c.id === 'hot_drinks');
    const kahveSade = hot.items.find((i) => i.id === 'kahve_sade');
    expect(kahveSade.photoUrl).toMatch(
      /cdn\.jsdelivr\.net.+kahve_sade\.jpg$/,
    );
  });

  it('falls back to the original src for ids not in the manifest', async () => {
    mockKiraathane();
    const { categories } = await fetchAndParseKiraathane();
    const cold = categories.find((c) => c.id === 'cold_drinks');
    const ayran = cold.items.find((i) => i.id === 'ayran');
    expect(ayran.photoUrl).toMatch(/\/kantin\/ayran\.jpg$/);
  });

  it('returns empty categories on an empty document', async () => {
    mockKiraathane('<html><body></body></html>');
    const out = await fetchAndParseKiraathane();
    expect(out.categories).toEqual([]);
  });

  it('propagates upstream HTTP errors', async () => {
    mockKiraathane('boom', 500);
    await expect(fetchAndParseKiraathane()).rejects.toThrow();
  });
});
