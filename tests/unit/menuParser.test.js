import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import nock from 'nock';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MENU_URL } from '../../public/config.js';
import { fetchAndParseMenu } from '../../public/parsers/menuParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/menu.html'),
  'utf-8',
);

const url = new URL(MENU_URL);

function mockMenu(html = fixture, status = 200) {
  return nock(url.origin).get(url.pathname).reply(status, html, {
    'content-type': 'text/html; charset=utf-8',
  });
}

describe('fetchAndParseMenu', () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('returns an object with foods, menus, and meta', async () => {
    mockMenu();
    const result = await fetchAndParseMenu();
    expect(result).toMatchObject({
      foods: expect.any(Array),
      menus: expect.any(Array),
      meta: expect.objectContaining({
        timezone: 'Asia/Bishkek',
        source: 'manas_kantin',
        lastUpdated: expect.any(String),
      }),
    });
    expect(() => new Date(result.meta.lastUpdated).toISOString()).not.toThrow();
  });

  it('groups items by date in YYYY-MM-DD format', async () => {
    mockMenu();
    const { menus } = await fetchAndParseMenu();
    expect(menus).toEqual([
      {
        date: '2025-02-10',
        items: ['mercimek_corbasi', 'izgara_tavuk', 'pirinc_pilavi'],
      },
      {
        date: '2025-02-11',
        items: ['tarhana_corbasi', 'izmir_kofte', 'makarna'],
      },
    ]);
  });

  it('drops a date that has no items', async () => {
    mockMenu();
    const { menus } = await fetchAndParseMenu();
    expect(menus.find((m) => m.date === '2025-02-12')).toBeUndefined();
  });

  it('produces unique food entries keyed by slug id', async () => {
    mockMenu();
    const { foods } = await fetchAndParseMenu();
    const ids = foods.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'mercimek_corbasi',
        'izgara_tavuk',
        'pirinc_pilavi',
        'tarhana_corbasi',
        'izmir_kofte',
        'makarna',
      ]),
    );
  });

  it('attaches calories from the following h6', async () => {
    mockMenu();
    const { foods } = await fetchAndParseMenu();
    const byId = Object.fromEntries(foods.map((f) => [f.id, f]));
    expect(byId.mercimek_corbasi.calories).toBe(150);
    expect(byId.izgara_tavuk.calories).toBe(320);
    expect(byId.izmir_kofte.calories).toBe(410);
  });

  it('translates known foods to ru and en', async () => {
    mockMenu();
    const { foods } = await fetchAndParseMenu();
    const lentil = foods.find((f) => f.id === 'mercimek_corbasi');
    expect(lentil.name).toEqual({
      tr: 'Mercimek Çorbası',
      ru: 'Чечевичный суп',
      en: 'Lentil Soup',
    });
  });

  it('uses CDN photo URLs for ids in the manifest', async () => {
    mockMenu();
    const { foods } = await fetchAndParseMenu();
    // izmir_kofte is a known id in manifest.json
    const kofte = foods.find((f) => f.id === 'izmir_kofte');
    expect(kofte.thumbUrl).toMatch(/cdn\.jsdelivr\.net.+izmir_kofte\.jpg$/);
    expect(kofte.fullPhotoUrl).toMatch(/cdn\.jsdelivr\.net.+izmir_kofte\.jpg$/);
  });

  it('falls back to the original src for ids not in the manifest', async () => {
    mockMenu();
    const { foods } = await fetchAndParseMenu();
    const makarna = foods.find((f) => f.id === 'makarna');
    expect(makarna.thumbUrl).toMatch(/\/kantin\/foods\/makarna\.jpg$/);
    expect(makarna.fullPhotoUrl).toMatch(/\/kantin\/foods\/makarna\.jpg$/);
  });

  it('does not leak the internal _originalUrl field into output', async () => {
    mockMenu();
    const { foods } = await fetchAndParseMenu();
    for (const f of foods) {
      expect(f).not.toHaveProperty('_originalUrl');
    }
  });

  it('skips logos and other img tags that are not under /kantin/foods/', async () => {
    mockMenu();
    const { foods } = await fetchAndParseMenu();
    for (const f of foods) {
      if (f.thumbUrl) {
        expect(f.thumbUrl).not.toMatch(/\/static\/logo\.png$/);
      }
    }
  });

  it('returns empty foods/menus on an empty document', async () => {
    mockMenu('<html><body></body></html>');
    const result = await fetchAndParseMenu();
    expect(result.foods).toEqual([]);
    expect(result.menus).toEqual([]);
  });

  it('propagates upstream HTTP errors', async () => {
    mockMenu('Service Unavailable', 503);
    await expect(fetchAndParseMenu()).rejects.toThrow();
  });
});
