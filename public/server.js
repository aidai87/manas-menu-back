import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { accessLog } from './middleware/accessLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = __dirname;

const MENU_FILE = path.join(PUBLIC_DIR, 'menu.json');
const BUFFET_FILE = path.join(PUBLIC_DIR, 'buffet.json');

export function createApp({ logSink } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(accessLog(logSink));

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: +process.uptime().toFixed(2),
      version: process.env.npm_package_version ?? '0.0.0',
    });
  });

  app.get('/menu', async (req, res, next) => {
    try {
      const raw = await fs.readFile(MENU_FILE, 'utf-8');
      res
        .status(200)
        .type('application/json')
        .set('cache-control', 'public, max-age=300')
        .send(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(503).json({
          error: 'menu_unavailable',
          message: 'Menu has not been scraped yet. Run `npm run scrape`.',
        });
      }
      next(err);
    }
  });

  app.get('/kiraathane', async (req, res, next) => {
    try {
      const raw = await fs.readFile(BUFFET_FILE, 'utf-8');
      res
        .status(200)
        .type('application/json')
        .set('cache-control', 'public, max-age=300')
        .send(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(503).json({
          error: 'kiraathane_unavailable',
          message: 'Kiraathane menu has not been scraped yet. Run `npm run scrape`.',
        });
      }
      next(err);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', path: req.originalUrl });
  });

  app.use((err, req, res, _next) => {
    res.status(500).json({ error: 'internal_error', message: err.message });
  });

  return app;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const PORT = Number(process.env.PORT) || 3000;
  const app = createApp();
  app.listen(PORT, () => {
    process.stdout.write(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'server_started',
        port: PORT,
      }) + '\n',
    );
  });
}
