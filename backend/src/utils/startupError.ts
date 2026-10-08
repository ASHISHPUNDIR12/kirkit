const messages: Record<string, string> = {
  EAI_AGAIN: 'Database hostname lookup failed. Check DNS, network access, and the DATABASE_URL hostname.',
  ENOTFOUND: 'Database hostname was not found. Check the DATABASE_URL hostname and DNS.',
  ETIMEDOUT: 'Database connection timed out. Check database availability, routing, and firewall rules.',
  ECONNREFUSED: 'Database connection was refused. Check the database host and port.',
  ENETUNREACH: 'Database network is unreachable. Check routing and network access.',
  EHOSTUNREACH: 'Database host is unreachable. Check routing and network access.',
  EADDRINUSE: 'PORT is already in use. Stop the other server or choose another PORT.',
  EPERM: 'The operating system denied network access. Check runtime sandbox or listener permissions.',
  EACCES: 'Permission denied. Check network and listener permissions.',
  P1000: 'Database authentication failed. Check the database credentials.',
  '28P01': 'Database authentication failed. Check the database credentials.',
  P1001: 'Cannot reach the database. Check the database host, port, and network access.',
  P1011: 'Database TLS connection failed. Check the database SSL configuration.',
  P2024: 'Database connection pool timed out. Check database availability and connection limits.',
  '3D000': 'The configured database does not exist. Check DATABASE_URL.',
  SELF_SIGNED_CERT_IN_CHAIN: 'Database TLS certificate verification failed. Configure the trusted CA; do not disable verification.',
};

export function startupErrorMessage(error: unknown): string {
  const seen = new Set<object>();
  function find(value: unknown): string | undefined {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (typeof record.code === 'string' && Object.hasOwn(messages, record.code)) return record.code;
    for (const key of ['cause', 'meta', 'driverAdapterError', 'originalError']) {
      const code = find(record[key]);
      if (code) return code;
    }
    if (Array.isArray(record.errors)) {
      for (const nested of record.errors) { const code = find(nested); if (code) return code; }
    }
  }
  const code = find(error);
  // Never print raw driver errors: they can contain connection URLs or credentials.
  return code
    ? `Backend startup failed [${code}]: ${messages[code]}`
    : 'Backend startup failed. Check database connectivity, DATABASE_URL, and runtime configuration.';
}
