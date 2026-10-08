// Read-only health checks plus invalid auth input; no account is created.
const input = process.argv[2] ?? 'http://127.0.0.1:3000';
let base;
try {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/^\/*$/.test(url.pathname)) throw new Error();
  base = url.origin;
} catch {
  console.error('Usage: npm run check:api -- http://HOST:3000 (or an HTTPS origin, without credentials)');
  process.exit(1);
}
for (const [path, method, expected] of [['/live', 'GET', 200], ['/health', 'GET', 200], ['/auth/login', 'POST', 400], ['/auth/signup', 'POST', 400], ['/matches', 'GET', 401]]) {
  try {
    const response = await fetch(`${base}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'POST' ? { body: '{}' } : {}),
    });
    const json = response.headers.get('content-type')?.includes('application/json');
    const body = json ? await response.json() : null;
    const validBody = path === '/health' ? body?.status === 'ok' && body?.database === 'connected' : path === '/live' ? body?.status === 'ok' : typeof body?.error === 'string';
    const ok = response.status === expected && json && validBody;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${method} ${base}${path}: HTTP ${response.status}, JSON=${!!json}; expected ${expected}`);
    if (!ok) process.exitCode = 1;
  } catch {
    console.error(`FAIL ${method} ${base}${path}: unable to get an API response (network, timeout, TLS or redirect).`);
    process.exitCode = 1;
    break;
  }
}
