'use client';

import { useEffect, useState } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  CircularProgress, 
  Alert,
  Chip,
  Stack,
  Paper,
} from '@mui/material';
import { EmojiEvents, Timer, CheckCircle } from '@mui/icons-material';
import AppShell from '@/components/layout/AppShell';
import PlayoffGameCard from '@/components/playoffs/PlayoffGameCard';
import { createClient } from '@/lib/supabase/client';
import { generateUnlockSchedule, isDraftComplete, getNextUnlockForSeed, getTimeUntilUnlock, type UnlockWindow } from '@/lib/playoffs/unlockSchedule';

type Team = {
  id: string;
  name: string;
  short_name: string;
  abbreviation: string;
  color_primary: string;
  logo: string;
};

type Game = {
  id: string;
  week: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  game_utc: string;
  status: string;
  home: Team;
  away: Team;
};

type PlayoffPick = {
  id: string;
  playoff_round_id: string;
  profile_id: string;
  game_id: string;
  team_id: string;
  pick_position: number;
  team?: Team;
  game?: Team;
};

type Participant = {
  id: string;
  profile_id: string;
  seed: number;
  picks_available: number;
  profile?: { display_name: string; email: string };
};

type Round = {
  id: string;
  league_season_id: string;
  week: number;
  round_type: string;
  status: string;
  draft_start_time: string;
  tiebreaker_game_id: string | null;
};

export default function PlayoffsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [round, setRound] = useState<Round | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [myPicks, setMyPicks] = useState<PlayoffPick[]>([]);
  const [allPicks, setAllPicks] = useState<PlayoffPick[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [schedule, setSchedule] = useState<UnlockWindow[]>([]);
  const [now, setNow] = useState(new Date());

  const supabase = createClient();

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const leagueSeasonId = localStorage.getItem('activeLeagueSeasonId');
      if (!leagueSeasonId) {
        setError('No league selected');
        setLoading(false);
        return;
      }

      const currentWeek = 17;

      const { data: roundData, error: roundError } = await supabase
        .from('playoff_rounds_v2')
        .select('*')
        .eq('league_season_id', leagueSeasonId)
        .eq('week', currentWeek)
        .in('round_type', ['semifinal', 'championship'])
        .single();

      if (roundError || !roundData) {
        setError('No active playoff round. Playoffs begin after Week 16.');
        setLoading(false);
        return;
      }
      setRound(roundData);

      if (roundData.draft_start_time) {
        const sched = generateUnlockSchedule(
          roundData.week as 17 | 18,
          new Date(roundData.draft_start_time),
          roundData.round_type as 'semifinal' | 'championship'
        );
        setSchedule(sched);
      }

      const { data: participantData } = await supabase
        .from('playoff_participants_v2')
        .select('*')
        .eq('playoff_round_id', roundData.id)
        .eq('profile_id', user.id)
        .single();

      setParticipant(participantData);

      const { data: allParticipantsData } = await supabase
        .from('playoff_participants_v2')
        .select(`*, profile:profiles(display_name, email)`)
        .eq('playoff_round_id', roundData.id)
        .order('seed', { ascending: true });

      setAllParticipants(allParticipantsData || []);

      const { data: picksData } = await supabase
        .from('playoff_picks_v2')
        .select(`*, team:teams(id, name, short_name, abbreviation, color_primary, logo)`)
        .eq('playoff_round_id', roundData.id);

      setAllPicks(picksData || []);
      setMyPicks((picksData || []).filter(p => p.profile_id === user.id));

      const { data: gamesData } = await supabase
        .from('games')
        .select(`
          id, week, home_team, away_team, home_score, away_score, game_utc, status,
          home:teams!games_home_team_fkey(id, name, short_name, abbreviation, color_primary, logo),
          away:teams!games_away_team_fkey(id, name, short_name, abbreviation, color_primary, logo)
        `)
        .eq('season', 2025)
        .eq('week', currentWeek)
        .order('game_utc', { ascending: true });

      setGames((gamesData as unknown as Game[]) || []);
      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const handlePick = async (gameId: string, teamId: string) => {
    if (!round || !participant || saving) return;

    const nextPickPosition = myPicks.length + 1;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/playoffs/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: round.id, gameId, teamId, pickPosition: nextPickPosition }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save pick');
      } else {
        const { data: picksData } = await supabase
          .from('playoff_picks_v2')
          .select(`*, team:teams(id, name, short_name, abbreviation, color_primary, logo)`)
          .eq('playoff_round_id', round.id);

        setAllPicks(picksData || []);
        setMyPicks((picksData || []).filter(p => p.profile_id === participant.profile_id));
      }
    } catch {
      setError('Network error');
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <AppShell>
        <Container sx={{ py: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      </AppShell>
    );
  }

  if (!round) {
    return (
      <AppShell>
        <Container sx={{ py: 4 }}>
          <Alert severity="info">{error || 'No active playoff round.'}</Alert>
        </Container>
      </AppShell>
    );
  }

  const draftComplete = schedule.length > 0 && isDraftComplete(schedule, now);
  const isPlayoffParticipant = participant && participant.seed <= 4;
  
  // Track taken TEAMS (not games!) - multiple people can pick from same game
  const takenTeamIds = new Set(
    allPicks
      .filter(p => p.profile_id !== participant?.profile_id)
      .map(p => p.team_id)
  );

  const getMyPickForGame = (gameId: string) => {
    return myPicks.find(p => p.game_id === gameId);
  };

  // Get next unlock info for timer
  const nextUnlock = participant && schedule.length > 0 && !draftComplete 
    ? getNextUnlockForSeed(schedule, participant.seed, now) 
    : null;

  return (
    <AppShell>
      {/* Main content - will be wrapped in DesktopLayout/MobileLayout by AppShell */}
      <Box sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <EmojiEvents sx={{ fontSize: 40, color: 'warning.main' }} />
            <Box>
              <Typography variant="h4" fontWeight={700}>
                {round.round_type === 'semifinal' ? 'Semifinals' : 'Championship'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Week {round.week} • {draftComplete ? 'Open Swaps (1/hour)' : 'Draft in Progress'}
              </Typography>
            </Box>
            {participant && (
              <Chip 
                label={`Seed #${participant.seed}`} 
                color="primary" 
                sx={{ ml: 'auto' }}
              />
            )}
          </Stack>
        </Box>

        {/* Next Pick Timer */}
        {nextUnlock && isPlayoffParticipant && (
          <Paper 
            elevation={3} 
            sx={{ 
              p: 3, 
              mb: 3, 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Timer sx={{ fontSize: 48 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" fontWeight={700}>
                  Next Pick Unlocks In
                </Typography>
                <Typography variant="h3" fontWeight={700}>
                  {getTimeUntilUnlock(nextUnlock.unlockTime, now)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                  Pick Position #{nextUnlock.pickPosition}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}

        {/* All Picks Made Banner */}
        {isPlayoffParticipant && draftComplete && myPicks.length === 4 && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircle />
              <Typography variant="body1" fontWeight={600}>
                All picks made! You can swap any pick once per hour until games lock.
              </Typography>
            </Stack>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Playoff Teams */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Playoff Teams
          </Typography>
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            {allParticipants.filter(p => p.seed <= 4).map((p) => (
              <Paper
                key={p.id}
                elevation={participant?.id === p.id ? 3 : 1}
                sx={{
                  p: 2,
                  border: 2,
                  borderColor: participant?.id === p.id ? 'primary.main' : 'divider',
                  minWidth: 200,
                  mb: 2,
                }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  #{p.seed} {p.profile?.display_name || p.profile?.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {allPicks.filter(pick => pick.profile_id === p.profile_id).length}/{p.picks_available} picks
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>

        {/* Games */}
        <Typography variant="h6" gutterBottom>
          Week {round.week} Games
        </Typography>
        <Stack spacing={2}>
          {games.map((game) => {
            const myPick = getMyPickForGame(game.id);
            const gameStarted = new Date(game.game_utc) <= now;
            
            return (
              <PlayoffGameCard
                key={game.id}
                game={game}
                selectedTeamId={myPick?.team_id}
                onSelectTeam={handlePick}
                disabled={saving || !isPlayoffParticipant}
                isLocked={gameStarted}
                takenTeamIds={takenTeamIds}
              />
            );
          })}
        </Stack>
      </Box>
    </AppShell>
  );
}
