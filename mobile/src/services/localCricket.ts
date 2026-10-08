import { randomUUID } from 'expo-crypto';
import { openAccountDatabase } from '../database/open';
import { createCricketRepository, type CricketRepository } from '../cricket/repository';
import { getSession } from './session';
import type { CreateMatchInput, ExtraEventType, StartMatchInput } from '../types/api';
import type { ScoringAction } from '../cricket/models';
import { authRequest } from './authApi';

const repositories = new Map<string, Promise<CricketRepository>>();
export function currentRepository() {
  const userId = getSession()?.user.id;
  if (!userId) throw new Error('Sign in to open your saved matches.');
  let repository = repositories.get(userId);
  if (!repository) {
    repository = openAccountDatabase(userId).then(db => createCricketRepository(db, randomUUID));
    repositories.set(userId, repository);
    void repository.catch(() => { repositories.delete(userId); });
  }
  return repository;
}
async function local<T>(work: (repository: CricketRepository) => Promise<T>): Promise<T> {
  try { return await work(await currentRepository()); }
  catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/SQLITE|database is locked|disk|constraint|sqlite/i.test(message)) {
      throw new Error('Could not access your saved match. Check device storage and try again. The last committed score is kept.');
    }
    throw error;
  }
}
const perform = (id: string, action: ScoringAction | { kind: 'UNDO' }, revision?: number) =>
  local(repo => repo.perform(id, action, { requestId: randomUUID(), revision }));
export const getMatches = () => local(repo => repo.getMatches());
export const getMatch = (id: string) => local(repo => repo.getMatch(id));
export const createMatch = (input: CreateMatchInput) => local(repo => repo.createMatch(input));
export const startMatch = (id: string, setup: StartMatchInput) => local(repo => repo.startMatch(id, setup));
export const getInnings = (id: string) => local(repo => repo.getInnings(id));
export const recordScore = (id: string, runs: number, revision?: number) => perform(id, { kind: 'SCORE', runs }, revision);
export const recordWicket = (id: string, revision?: number) => perform(id, { kind: 'WICKET' }, revision);
export const recordExtra = (id: string, kind: ExtraEventType, revision?: number) => perform(id, { kind }, revision);
export const addNewBatsman = (id: string, playerName: string, revision?: number) => perform(id, { kind: 'NEW_BATSMAN', playerName }, revision);
export const changeBowler = (id: string, playerName: string, revision?: number) => perform(id, { kind: 'CHANGE_BOWLER', playerName }, revision);
export const endInnings = (id: string, revision?: number) => perform(id, { kind: 'END_INNINGS' }, revision);
export const undoLastAction = (id: string, revision: number) => perform(id, { kind: 'UNDO' }, revision);
export const startSecondInnings = (id: string, setup: Omit<StartMatchInput, 'battingFirstTeam'>) => local(repo => repo.startSecondInnings(id, setup));
export const finishMatch = (id: string, revision?: number) => local(repo => repo.finishMatch(id, { requestId: randomUUID(), revision }));
export const getTeams = () => local(repo => repo.getTeams());
export const createTeam = (name: string) => local(repo => repo.createTeam(name));
export const addTeamPlayer = (teamId: string, name: string) => local(repo => repo.addTeamPlayer(teamId, name));
export const importLegacyMatches = async () => {
  const payload = await authRequest<{ version: number; teams: { id: string; name: string; players: { id: string; name: string }[] }[]; matches: Record<string, unknown>[] }>('/auth/migration/export');
  return local(repo => repo.importLegacy(payload));
};
