import { validatePlayerName } from "./validatePlayerName.js";

export type SecondInningsSetup = {
  strikerName: string;
  nonStrikerName: string;
  bowlerName: string;
};

export function validateSecondInnings(
  body: unknown,
): { valid: true; data: SecondInningsSetup } | { valid: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      valid: false,
      error: "Enter the second-innings striker, non-striker, and bowler.",
    };
  }
  const values = body as Record<string, unknown>;
  const names = ["strikerName", "nonStrikerName", "bowlerName"] as const;
  const validatedNames = names.map((name) =>
    validatePlayerName(
      values[name],
      name === "bowlerName" ? "bowler" : "batsman",
    ),
  );
  const invalidName = validatedNames.find((result) => !result.valid);
  if (invalidName && !invalidName.valid) return invalidName;
  const data = Object.fromEntries(
    names.map((name, index) => [
      name,
      validatedNames[index].valid ? validatedNames[index].name : "",
    ]),
  ) as SecondInningsSetup;
  if (data.strikerName.toLowerCase() === data.nonStrikerName.toLowerCase()) {
    return {
      valid: false,
      error: "Enter a different name for each opening batsman.",
    };
  }
  return { valid: true, data };
}
