import { useCallback, useEffect, useState } from 'react';
import { getTeams } from '../services/api';
import type { Team } from '../types/api';
export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setTeams(await getTeams()); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to load teams.'); }
  }, []);
  useEffect(() => {
    let active = true;
    getTeams().then(result => { if (active) { setTeams(result); setError(''); } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Unable to load teams.'); });
    return () => { active = false; };
  }, []);
  return { teams, error, refresh };
}
