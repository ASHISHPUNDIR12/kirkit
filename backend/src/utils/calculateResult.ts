export type MatchResult = { winner: string | null; result: string };

export function calculateResult(input: {
  battingFirstTeam: string;
  battingSecondTeam: string;
  firstInningsRuns: number;
  secondInningsRuns: number;
  secondInningsWickets: number;
}): MatchResult {
  const { battingFirstTeam, battingSecondTeam, firstInningsRuns, secondInningsRuns, secondInningsWickets } = input;
  if (secondInningsRuns > firstInningsRuns) {
    return { winner: battingSecondTeam, result: `${battingSecondTeam} won by ${Math.max(0, 10 - secondInningsWickets)} wickets` };
  }
  if (firstInningsRuns > secondInningsRuns) {
    return { winner: battingFirstTeam, result: `${battingFirstTeam} won by ${firstInningsRuns - secondInningsRuns} runs` };
  }
  return { winner: null, result: 'Match tied' };
}
