'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Button,
} from '@mui/material';
import { Lock, LockOpen, Timer, EmojiEvents, Check } from '@mui/icons-material';
import AppShell from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import {
  generateUnlockSchedule,
  isPickUnlocked,
  isDraftComplete,
  getTimeUntilUnlock,
  UnlockWindow,
} from '@/lib/playoffs/unlockSchedule';

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
  team_id: string;
  game_id: string;
  pick_position: number;
  points: number;
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

  const handlePick = async (gameId: string, teamId: string, pickPosition: number) => {
    if (!round || !participant || saving) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/playoffs/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: round.id, gameId, teamId, pickPosition }),
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

  const getUnlockedPositions = () => {
    if (!participant || !isPlayoffParticipant) return [1, 2, 3, 4];
    if (draftComplete) return [1, 2, 3, 4];
    return [1, 2, 3, 4].filter(pos => isPickUnlocked(schedule, participant.seed, pos, now));
  };

  const unlockedPositions = getUnlockedPositions();

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
                Week {round.week} • {draftComplete ? 'Open Swaps' : 'Draft in Progress'}
              </Typography>
            </Box>
            {participant && (
              <Chip label={`Seed #${participant.seed}`} color="primary" sx={{ ml: 'auto' }} />
            )}
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Playoff Teams Status */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Playoff Teams
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            {allParticipants.filter(p => p.seed <= 4).map((p) => {
              const theirPicks = allPicks.filter(pick => pick.profile_id === p.profile_id);
              const isMe = p.profile_id === participant?.profile_id;

              return (
                <Paper
                  key={p.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: isMe ? 'primary.50' : 'background.paper',
                    border: isMe ? 2 : 1,
                    borderColor: isMe ? 'primary.main' : 'divider',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700}>
                    #{p.seed} {p.profile?.display_name || p.profile?.email?.split('@')[0]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {theirPicks.length}/{p.picks_available} picks
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    {[1, 2, 3, 4].map(pos => {
                      const pick = theirPicks.find(pk => pk.pick_position === pos);
                      const unlocked = isPickUnlocked(schedule, p.seed, pos, now);

                      return (
                        <Box
                          key={pos}
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: 1,
                            borderColor: pick ? pick.team?.color_primary : 'divider',
                            bgcolor: pick ? pick.team?.color_primary : (unlocked ? 'success.light' : 'grey.200'),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {pick ? (
                            <Typography variant="caption" sx={{ color: 'white', fontSize: 10 }}>
                              {pick.team?.abbreviation?.slice(0, 2)}
                            </Typography>
                          ) : unlocked ? (
                            <LockOpen sx={{ fontSize: 12, color: 'success.dark' }} />
                          ) : (
                            <Lock sx={{ fontSize: 12, color: 'grey.500' }} />
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Paper>

        {/* My Pick Slots */}
        {participant && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Your Picks
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              {[1, 2, 3, 4].map(pos => {
                const pick = myPicks.find(p => p.pick_position === pos);
                const unlocked = unlockedPositions.includes(pos);
                const nextUnlock = schedule.find(w => w.seed === participant.seed && w.pickPosition === pos);

                return (
                  <Paper
                    key={pos}
                    variant="outlined"
                    sx={{
                      p: 2,
                      height: 120,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: pick ? 'success.50' : (unlocked ? 'background.paper' : 'grey.100'),
                      border: 2,
                      borderColor: pick ? pick.team?.color_primary : (unlocked ? 'success.main' : 'grey.300'),
                    }}
                  >
                    {pick ? (
                      <>
                        <Box
                          component="img"
                          src={pick.team?.logo}
                          alt={pick.team?.abbreviation}
                          sx={{ width: 40, height: 40, mb: 1 }}
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {pick.team?.short_name}
                        </Typography>
                      </>
                    ) : unlocked ? (
                      <>
                        <LockOpen color="success" sx={{ mb: 1 }} />
                        <Typography variant="body2" color="success.main">
                          Pick {pos} - Ready
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Lock color="disabled" sx={{ mb: 1 }} />
                        <Typography variant="body2" color="text.disabled">
                          Pick {pos}
                        </Typography>
                        {nextUnlock && (
                          <Typography variant="caption" color="text.secondary">
                            <Timer sx={{ fontSize: 12, mr: 0.5 }} />
                            {getTimeUntilUnlock(nextUnlock.unlockTime, now)}
                          </Typography>
                        )}
                      </>
                    )}
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        )}

        {/* Games Grid */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Week {round.week} Games
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {games.map(game => {
              const isTaken = takenGameIds.has(game.id);
              const myPickForGame = myPicks.find(p => p.game_id === game.id);
              const gameStarted = new Date(game.game_utc) <= now;
              const canPick = !isTaken && !gameStarted && unlockedPositions.length > myPicks.length;

              return (
                <Paper
                  key={game.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    opacity: isTaken || gameStarted ? 0.5 : 1,
                    bgcolor: myPickForGame ? 'success.50' : 'background.paper',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {new Date(game.game_utc).toLocaleString('en-US', {
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {isTaken && ' • Taken'}
                    {gameStarted && ' • Started'}
                  </Typography>

                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Button
                      variant={myPickForGame?.team_id === game.away.id ? 'contained' : 'outlined'}
                      disabled={!canPick && myPickForGame?.team_id !== game.away.id}
                      onClick={() => handlePick(game.id, game.away.id, myPicks.length + 1)}
                      sx={{
                        justifyContent: 'flex-start',
                        borderColor: game.away.color_primary,
                        color: myPickForGame?.team_id === game.away.id ? 'white' : game.away.color_primary,
                        bgcolor: myPickForGame?.team_id === game.away.id ? game.away.color_primary : 'transparent',
                        '&:hover': {
                          bgcolor: myPickForGame?.team_id === game.away.id ? game.away.color_primary : `${game.away.color_primary}20`,
                        },
                      }}
                      startIcon={
                        <Box component="img" src={game.away.logo} sx={{ width: 24, height: 24 }} />
                      }
                    >
                      {game.away.short_name}
                      {myPickForGame?.team_id === game.away.id && <Check sx={{ ml: 'auto' }} />}
                    </Button>

                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                      @
                    </Typography>

                    <Button
                      variant={myPickForGame?.team_id === game.home.id ? 'contained' : 'outlined'}
                      disabled={!canPick && myPickForGame?.team_id !== game.home.id}
                      onClick={() => handlePick(game.id, game.home.id, myPicks.length + 1)}
                      sx={{
                        justifyContent: 'flex-start',
                        borderColor: game.home.color_primary,
                        color: myPickForGame?.team_id === game.home.id ? 'white' : game.home.color_primary,
                        bgcolor: myPickForGame?.team_id === game.home.id ? game.home.color_primary : 'transparent',
                        '&:hover': {
                          bgcolor: myPickForGame?.team_id === game.home.id ? game.home.color_primary : `${game.home.color_primary}20`,
                        },
                      }}
                      startIcon={
                        <Box component="img" src={game.home.logo} sx={{ width: 24, height: 24 }} />
                      }
                    >
                      {game.home.short_name}
                      {myPickForGame?.team_id === game.home.id && <Check sx={{ ml: 'auto' }} />}
                    </Button>
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Paper>
      </Container>
    </AppShell>
  );
}
