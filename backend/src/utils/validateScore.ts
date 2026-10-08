const allowedRuns = [0, 1, 2, 3, 4, 6] as const;
export type ScoredRuns = (typeof allowedRuns)[number];

export function validateScore(
  body: unknown,
): { valid: true; runs: ScoredRuns } | { valid: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Choose a score of 0, 1, 2, 3, 4, or 6." };
  }
  const runs = (body as Record<string, unknown>).runs;
  if (typeof runs !== "number" || !allowedRuns.includes(runs as ScoredRuns)) {
    return { valid: false, error: "Choose a score of 0, 1, 2, 3, 4, or 6." };
  }
  return { valid: true, runs: runs as ScoredRuns };
}
