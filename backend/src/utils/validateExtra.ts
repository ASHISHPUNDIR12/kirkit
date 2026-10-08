export type ExtraEventType = "WIDE" | "NO_BALL";

export function validateExtra(
  body: unknown,
):
  | { valid: true; eventType: ExtraEventType }
  | { valid: false; error: string } {
  const eventType =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).eventType
      : undefined;
  if (eventType !== "WIDE" && eventType !== "NO_BALL") {
    return { valid: false, error: "Choose Wide or No Ball." };
  }
  return { valid: true, eventType };
}
