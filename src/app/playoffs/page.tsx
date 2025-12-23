'use client';

import { useEffect, useState } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Stack, 
  CircularProgress, 
  Alert,
  Paper,
  Chip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { EmojiEvents, Lock } from '@mui/icons-material';
import AppShell from '@/components/layout/AppShell';
import PlayoffGameCard from '@/components/playoffs/PlayoffGameCard';
import { createClient } from '@/lib/supabase/client';
import { generateUnlockSchedule, isDraftComplete, isPickUnlocked, type UnlockWindow } from '@/lib/playoffs/unlockSchedule';

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
  game?: Game;
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
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
  const takenGameIds = new Set(allPicks.filter(p => p.profile_id !== participant?.profile_id).map(p => p.game_id));

  const getMyPickForGame = (gameId: string) => {
    return myPicks.find(p => p.game_id === gameId);
  };

  return (
    <AppShell>
      <Container maxWidth="xl" sx={{ py: 3 }}>
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
          <Grid container spacing={2}>
            {allParticipants.filter(p => p.seed <= 4).map((p) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={p.id}>
                <Paper
                  elevation={participant?.id === p.id ? 3 : 1}
                  sx={{
                    p: 2,
                    border: 2,
                    borderColor: participant?.id === p.id ? 'primary.main' : 'divider',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700}>
                    #{p.seed} {p.profile?.display_name || p.profile?.email}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {allPicks.filter(pick => pick.profile_id === p.profile_id).length}/{p.picks_available} picks
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    {[1, 2, 3, 4].map((pos) => {
                      const hasPick = allPicks.some(
                        pick => pick.profile_id === p.profile_id && pick.pick_position === pos
                      );
                      return (
                        <Box
                          key={pos}
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: hasPick ? 'success.main' : 'grey.300',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {!hasPick && <Lock sx={{ fontSize: 14, color: 'grey.600' }} />}
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Games */}
        <Typography variant="h6" gutterBottom>
          Week {round.week} Games
        </Typography>
        <Grid container spacing={2}>
          {games.map((game) => {
            const myPick = getMyPickForGame(game.id);
            const isTaken = takenGameIds.has(game.id);
            const gameStarted = new Date(game.game_utc) <= now;
            
            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={game.id}>
                <PlayoffGameCard
                  game={game}
                  selectedTeamId={myPick?.team_id}
                  onSelectTeam={handlePick}
                  disabled={saving || !isPlayoffParticipant}
                  isLocked={gameStarted}
                  isTaken={isTaken}
                />
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </AppShell>
  );
}
