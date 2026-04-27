import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import nock from 'nock';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { KIRAATHANE_URL, MENU_URL } from '../../public/config.js';
import { saveJsonFiles } from '../../public/services/saveJsonFiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const MENU_PATH = path.join(PUBLIC_DIR, 'menu.json');
const BUFFET_PATH = path.join(PUBLIC_DIR, 'buffet.json');

const menuFixture = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/menu.html'),
  'utf-8',
);
const kiraathaneFixture = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/kiraathane.html'),
  'utf-8',
);

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

describe('saveJsonFiles', () => {
  let menuBackup;
  let buffetBackup;

  beforeAll(() => {
    nock.disableNetConnect();
    menuBackup = backup(MENU_PATH);
    buffetBackup = backup(BUFFET_PATH);
  });

  afterEach(() => {
    nock.cleanAll();
    restore(MENU_PATH, menuBackup);
    restore(BUFFET_PATH, buffetBackup);
  });

  it('writes menu.json and buffet.json with valid JSON content', async () => {
    nock(new URL(MENU_URL).origin)
      .get(new URL(MENU_URL).pathname)
      .reply(200, menuFixture);
    nock(new URL(KIRAATHANE_URL).origin)
      .get(new URL(KIRAATHANE_URL).pathname)
      .reply(200, kiraathaneFixture);

    await saveJsonFiles();

    const menu = JSON.parse(fs.readFileSync(MENU_PATH, 'utf-8'));
    const buffet = JSON.parse(fs.readFileSync(BUFFET_PATH, 'utf-8'));

    expect(menu).toHaveProperty('foods');
    expect(menu).toHaveProperty('menus');
    expect(buffet).toHaveProperty('categories');
    expect(buffet.meta.currency).toBe('KGS');
  });

  it('throws when the upstream menu source is unavailable', async () => {
    nock(new URL(MENU_URL).origin)
      .get(new URL(MENU_URL).pathname)
      .reply(503);
    nock(new URL(KIRAATHANE_URL).origin)
      .get(new URL(KIRAATHANE_URL).pathname)
      .reply(200, kiraathaneFixture);

    await expect(saveJsonFiles()).rejects.toThrow();
  });
});
