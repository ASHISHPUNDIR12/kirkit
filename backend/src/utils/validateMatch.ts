export type CreateMatchInput = {
  team1Id?: string;
  team2Id?: string;
  team1Name: string;
  team2Name: string;
  oversLimit: number;
};
export type StartMatchInput = {
  battingFirstTeam: string;
  strikerName: string;
  nonStrikerName: string;
  bowlerName: string;
};

export function validateStartMatch(
  body: unknown,
): { valid: true; data: StartMatchInput } | { valid: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      valid: false,
      error: "Choose the batting team and enter all three player names.",
    };
  }
  const values = body as Record<string, unknown>;
  const keys = [
    "battingFirstTeam",
    "strikerName",
    "nonStrikerName",
    "bowlerName",
  ] as const;
  if (
    keys.some((key) => typeof values[key] !== "string" || !values[key].trim())
  ) {
    return {
      valid: false,
      error: "Choose the batting team and enter all three player names.",
    };
  }
  const data = Object.fromEntries(
    keys.map((key) => [key, (values[key] as string).trim()]),
  ) as StartMatchInput;
  if (keys.some((key) => data[key].length > 60)) {
    return {
      valid: false,
      error: "Player and team names must be 60 characters or fewer.",
    };
  }
  if (data.strikerName.toLowerCase() === data.nonStrikerName.toLowerCase()) {
    return {
      valid: false,
      error: "Enter a different name for each opening batsman.",
    };
  }
  return { valid: true, data };
}

export function validateMatch(
  body: unknown,
): { valid: true; data: CreateMatchInput } | { valid: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      valid: false,
      error: "Enter both team names and the number of overs.",
    };
  }
  const { team1Name, team2Name, oversLimit } = body as Record<string, unknown>;
  if (
    typeof team1Name !== "string" ||
    typeof team2Name !== "string" ||
    !team1Name.trim() ||
    !team2Name.trim()
  ) {
    return { valid: false, error: "Both team names are required." };
  }
  const team1 = team1Name.trim();
  const team2 = team2Name.trim();
  if (team1.length > 60 || team2.length > 60) {
    return {
      valid: false,
      error: "Team names must be 60 characters or fewer.",
    };
  }
  if (team1.toLowerCase() === team2.toLowerCase()) {
    return { valid: false, error: "Choose a different name for each team." };
  }
  if (
    typeof oversLimit !== "number" ||
    !Number.isInteger(oversLimit) ||
    oversLimit < 1 ||
    oversLimit > 2147483647
  ) {
    return {
      valid: false,
      error: "Overs must be a whole number between 1 and 2147483647.",
    };
  }
  const { team1Id, team2Id } = body as Record<string, unknown>;
  for (const id of [team1Id, team2Id]) {
    if (id !== undefined && (typeof id !== 'string' || !id || id.length > 128)) return { valid: false, error: 'Choose a valid saved team.' };
  }
  return { valid: true, data: { team1Name: team1, team2Name: team2, oversLimit,
    ...(team1Id ? { team1Id: team1Id as string } : {}), ...(team2Id ? { team2Id: team2Id as string } : {}),
  } };
}
