export function validatePlayerName(
  value: unknown,
  playerRole: string,
): { valid: true; name: string } | { valid: false; error: string } {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 60) {
    return {
      valid: false,
      error: `Enter a ${playerRole} name of 1 to 60 characters.`,
    };
  }
  return { valid: true, name: value.trim() };
}
