// Rate limiter in-memory a finestra fissa, sufficiente per un'app single-node.
// Ogni chiave (default: IP client) ha un budget di richieste per finestra;
// oltre il limite risponde 429. I tentativi falliti contano, quelli riusciti
// possono essere "premiati" dal chiamante con reset().
export function createRateLimiter({ windowMs, max }) {
  const buckets = new Map(); // key -> { count, resetAt }

  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, Math.min(windowMs, 60 * 1000)).unref?.();

  const middleware = (keyFn = (req) => req.ip) => {
    const handler = (req, res, next) => {
      const key = keyFn(req);
      const now = Date.now();
      let b = buckets.get(key);
      if (!b || b.resetAt <= now) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
      }
      b.count += 1;
      if (b.count > max) {
        const retryAfter = Math.ceil((b.resetAt - now) / 1000);
        res.setHeader("Retry-After", String(retryAfter));
        return res
          .status(429)
          .json({ error: "Troppi tentativi. Riprova più tardi." });
      }
      req.rateLimitKey = key;
      next();
    };
    handler.reset = (key) => buckets.delete(key);
    return handler;
  };

  return middleware;
}
