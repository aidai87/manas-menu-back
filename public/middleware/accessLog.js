import { performance } from 'node:perf_hooks';

export function accessLog(write = (line) => process.stdout.write(line + '\n')) {
  return (req, res, next) => {
    const start = performance.now();
    res.on('finish', () => {
      const durationMs = +(performance.now() - start).toFixed(2);
      const entry = {
        ts: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
        bytes: Number(res.getHeader('content-length')) || 0,
        ua: req.headers['user-agent'] ?? null,
      };
      write(JSON.stringify(entry));
    });
    next();
  };
}
