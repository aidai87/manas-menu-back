import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../public/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const MENU_PATH = path.join(PUBLIC_DIR, 'menu.json');
const BUFFET_PATH = path.join(PUBLIC_DIR, 'buffet.json');

function backup(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
}
function restore(file, contents) {
  if (contents === null) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } else {
    fs.writeFileSync(file, contents);
  }
}

const logs = [];
const app = createApp({ logSink: (line) => logs.push(JSON.parse(line)) });

describe('GET /health', () => {
  it('responds 200 with status, uptime, version', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.version).toBe('string');
  });

  it('emits a structured access log entry', async () => {
    logs.length = 0;
    await request(app).get('/health');
    expect(logs.length).toBeGreaterThan(0);
    const entry = logs[logs.length - 1];
    expect(entry).toMatchObject({
      method: 'GET',
      path: '/health',
      status: 200,
      durationMs: expect.any(Number),
    });
  });
});

describe('GET /menu', () => {
  let originalMenu;

  beforeAll(() => {
    originalMenu = backup(MENU_PATH);
    fs.writeFileSync(
      MENU_PATH,
      JSON.stringify({
        foods: [{ id: 'pilav', name: { tr: 'Pilav' } }],
        menus: [{ date: '2025-02-10', items: ['pilav'] }],
        meta: { timezone: 'Asia/Bishkek', source: 'manas_kantin' },
      }),
    );
  });

  afterAll(() => {
    restore(MENU_PATH, originalMenu);
  });

  it('responds 200 with parseable JSON when the file exists', async () => {
    const res = await request(app).get('/menu');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.foods).toBeDefined();
    expect(res.body.menus[0].date).toBe('2025-02-10');
  });

  it('sets a sensible cache-control header', async () => {
    const res = await request(app).get('/menu');
    expect(res.headers['cache-control']).toMatch(/max-age=\d+/);
  });
});

describe('GET /menu when the file is missing', () => {
  let originalMenu;

  beforeAll(() => {
    originalMenu = backup(MENU_PATH);
    if (fs.existsSync(MENU_PATH)) fs.unlinkSync(MENU_PATH);
  });

  afterAll(() => {
    restore(MENU_PATH, originalMenu);
  });

  it('responds 503 with a recoverable error message', async () => {
    const res = await request(app).get('/menu');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('menu_unavailable');
    expect(res.body.message).toMatch(/scrape/);
  });
});

describe('GET /kiraathane', () => {
  let originalBuffet;

  beforeAll(() => {
    originalBuffet = backup(BUFFET_PATH);
    fs.writeFileSync(
      BUFFET_PATH,
      JSON.stringify({
        categories: [{ id: 'hot_drinks', title: 'SICAK İÇECEK', items: [] }],
        meta: {
          timezone: 'Asia/Bishkek',
          currency: 'KGS',
          lastUpdated: new Date().toISOString(),
        },
      }),
    );
  });

  afterAll(() => {
    restore(BUFFET_PATH, originalBuffet);
  });

  it('responds 200 with the buffet JSON', async () => {
    const res = await request(app).get('/kiraathane');
    expect(res.status).toBe(200);
    expect(res.body.categories[0].id).toBe('hot_drinks');
  });
});

describe('unknown route', () => {
  it('responds 404 with an error envelope', async () => {
    const res = await request(app).get('/no-such-thing');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'not_found',
      path: '/no-such-thing',
    });
  });
});
