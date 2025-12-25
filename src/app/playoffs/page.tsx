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
import { EmojiEvents, Timer, CheckCircle, Lock, LockOpen } from '@mui/icons-material';
import AppShell from '@/components/layout/AppShell';
import PlayoffGameCard from '@/components/playoffs/PlayoffGameCard';
import { createClient } from '@/lib/supabase/client';
import { generateUnlockSchedule, isDraftComplete, getNextUnlockForSeed, getTimeUntilUnlock, isPickUnlocked, type UnlockWindow } from '@/lib/playoffs/unlockSchedule';

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
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

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
        .select('*, profile:profiles(display_name, email)')
        .eq('playoff_round_id', roundData.id)
        .eq('profile_id', user.id)
        .single();

      // Transform profile array to single object
      const transformedParticipant = participantData ? {
        ...participantData,
        profile: Array.isArray(participantData.profile) ? participantData.profile[0] : participantData.profile
      } : null;

      setParticipant(transformedParticipant);

      const { data: allParticipantsData } = await supabase
        .from('playoff_participants_v2')
        .select(`*, profile:profiles(display_name, email)`)
        .eq('playoff_round_id', roundData.id)
        .lte('seed', 4)
        .order('seed', { ascending: true });

      // Transform all participants
      const transformedParticipants = (allParticipantsData || []).map(p => ({
        ...p,
        profile: Array.isArray(p.profile) ? p.profile[0] : p.profile
      }));

      setAllParticipants(transformedParticipants);

      const { data: picksData } = await supabase
        .from('playoff_picks_v2')
        .select(`
          id,
          playoff_round_id,
          profile_id,
          game_id,
          team_id,
          pick_position,
          team:teams(id, name, short_name, abbreviation, color_primary, logo),
          game:games(id, game_utc)
        `)
        .eq('playoff_round_id', roundData.id);

      // Transform picks
      const transformedPicks = (picksData || []).map((p: any) => ({
        ...p,
        team: Array.isArray(p.team) ? p.team[0] : p.team,
        game: Array.isArray(p.game) ? p.game[0] : p.game,
      }));

      setAllPicks(transformedPicks);
      setMyPicks(transformedPicks.filter(p => p.profile_id === user.id));

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
          .select(`
            id,
            playoff_round_id,
            profile_id,
            game_id,
            team_id,
            pick_position,
            team:teams(id, name, short_name, abbreviation, color_primary, logo),
            game:games(id, game_utc)
          `)
          .eq('playoff_round_id', round.id);

        const transformedPicks = (picksData || []).map((p: any) => ({
          ...p,
          team: Array.isArray(p.team) ? p.team[0] : p.team,
          game: Array.isArray(p.game) ? p.game[0] : p.game,
        }));

        setAllPicks(transformedPicks);
        setMyPicks(transformedPicks.filter(p => p.profile_id === participant.profile_id));
      }
    } catch {
      setError('Network error');
    }

    setSaving(false);
  };

  // Check if a pick is unlocked for a user
  const isPickUnlockedForUser = (participantObj: Participant, pickPosition: number): boolean => {
    if (!round || !schedule.length) return false;
    const draftComplete = isDraftComplete(schedule, now);
    if (draftComplete) return true;
    return isPickUnlocked(schedule, participantObj.seed, pickPosition, now);
  };

  // Check if game has started/locked
  const isGameLocked = (pick: PlayoffPick): boolean => {
    if (!pick.game?.game_utc) return false;
    return new Date(pick.game.game_utc) <= now;
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

        {/* Playoff Teams with Pick Boxes */}
        <Typography variant="h5" gutterBottom sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEvents sx={{ color: 'warning.main' }} />
          Playoff Teams
        </Typography>
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 4
        }}>
          {allParticipants.map((participantObj) => {
            const participantPicks = allPicks.filter(p => p.profile_id === participantObj.profile_id);
            const isCurrentUser = participantObj.profile_id === userId;

            return (
              <Paper 
                key={participantObj.id}
                elevation={isCurrentUser ? 4 : 2}
                sx={{ 
                  p: 2, 
                  border: 2,
                  borderColor: isCurrentUser ? 'primary.main' : 'divider',
                  background: isCurrentUser ? 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(66, 165, 245, 0.05) 100%)' : 'background.paper',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Chip 
                    label={`#${participantObj.seed}`} 
                    size="small" 
                    color={isCurrentUser ? 'primary' : 'default'}
                    sx={{ fontWeight: 700 }}
                  />
                  <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }} noWrap>
                    {participantObj.profile?.display_name || participantObj.profile?.email?.split('@')[0]}
                  </Typography>
                  {isCurrentUser && (
                    <Typography variant="caption" color="primary.main" fontWeight={600}>
                      YOU
                    </Typography>
                  )}
                </Stack>

                {/* Pick Progress */}
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {participantPicks.length}/{participantObj.picks_available} picks made
                </Typography>

                {/* Picks Grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
                  {[1, 2, 3, 4].map((position) => {
                    const pick = participantPicks.find(p => p.pick_position === position);
                    const unlocked = isCurrentUser && !pick && isPickUnlockedForUser(participantObj, position);
                    const gameLocked = pick ? isGameLocked(pick) : false;
                    
                    return (
                      <Box
                        key={position}
                        sx={{
                          aspectRatio: '1',
                          borderRadius: 1,
                          bgcolor: pick 
                            ? (gameLocked ? 'background.paper' : '#1e3a1e')
                            : unlocked 
                              ? '#1e2a3a' 
                              : 'grey.800',
                          border: pick 
                            ? (gameLocked ? `1px solid ${pick.team?.color_primary}` : '1px solid #4caf50')
                            : unlocked
                              ? '2px solid #42a5f5'
                              : '1px solid',
                          borderColor: pick 
                            ? (gameLocked ? pick.team?.color_primary : '#4caf50')
                            : unlocked 
                              ? '#42a5f5' 
                              : 'grey.700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: unlocked ? '0 0 12px rgba(66, 165, 245, 0.4)' : 'none',
                          animation: unlocked ? 'pulse 2s ease-in-out infinite' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                            '50%': { opacity: 0.85, transform: 'scale(1.02)' },
                          },
                        }}
                      >
                        {pick ? (
                          gameLocked ? (
                            // Game locked - show team logo
                            <Box
                              component="img"
                              src={pick.team?.logo}
                              alt={pick.team?.abbreviation}
                              sx={{ 
                                width: '75%', 
                                height: '75%', 
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                              }}
                            />
                          ) : (
                            // Game not locked - show checkmark
                            <CheckCircle sx={{ fontSize: 28, color: '#4caf50' }} />
                          )
                        ) : unlocked ? (
                          // Unlocked - ready to pick
                          <LockOpen sx={{ fontSize: 20, color: '#42a5f5' }} />
                        ) : (
                          // Locked
                          <Lock sx={{ fontSize: 14, color: 'grey.600' }} />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            );
          })}
        </Box>

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
