'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Stack,
  Chip,
} from '@mui/material';
import { EmojiEvents, Lock, LockOpen, CheckCircle } from '@mui/icons-material';
import AppShell from '@/components/layout/AppShell';
import PlayoffGameCard from '@/components/playoffs/PlayoffGameCard';
import { generateUnlockSchedule, isPickUnlocked, isDraftComplete, UnlockWindow } from '@/lib/playoffs/unlockSchedule';

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
  profile_id: string;
  team_id: string;
  pick_position: number;
  game_id: string;
  last_swap_at?: string;
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

      // Get all Week 17 & 18 rounds
      const { data: allRounds, error: roundsError } = await supabase
        .from('playoff_rounds_v2')
        .select('*')
        .eq('league_season_id', leagueSeasonId)
        .in('week', [17, 18])
        .order('week', { ascending: false });

      if (roundsError || !allRounds || allRounds.length === 0) {
        setError('No active playoff rounds. Playoffs begin after Week 16.');
        setLoading(false);
        return;
      }

      // Find which round the current user is participating in
      let userRound = null;
      let userParticipant = null;

      for (const round of allRounds) {
        const { data: participantData } = await supabase
          .from('playoff_participants_v2')
          .select('*, profile:profiles(display_name, email)')
          .eq('playoff_round_id', round.id)
          .eq('profile_id', user.id)
          .single();

        if (participantData) {
          userRound = round;
          userParticipant = {
            ...participantData,
            profile: Array.isArray(participantData.profile) ? participantData.profile[0] : participantData.profile
          };
          break;
        }
      }

      if (!userRound || !userParticipant) {
        setError('You are not participating in any playoff round');
        setLoading(false);
        return;
      }

      setRound(userRound);
      setParticipant(userParticipant);

      // Only generate schedule for championship/semifinal rounds
      if ((userRound.round_type === 'championship' || userRound.round_type === 'semifinal') && userRound.draft_start_time) {
        const sched = generateUnlockSchedule(
          userRound.week as 17 | 18,
          new Date(userRound.draft_start_time),
          userRound.round_type as 'semifinal' | 'championship'
        );
        setSchedule(sched);
      }

      // Load all participants in this round
      const { data: allParticipantsData } = await supabase
        .from('playoff_participants_v2')
        .select('*, profile:profiles(display_name, email)')
        .eq('playoff_round_id', userRound.id)
        .order('seed', { ascending: true });

      const transformedAllParticipants = (allParticipantsData || []).map((p: any) => ({
        ...p,
        profile: Array.isArray(p.profile) ? p.profile[0] : p.profile
      }));

      setAllParticipants(transformedAllParticipants);

      // Load picks
      const { data: picksData } = await supabase
        .from('playoff_picks_v2')
        .select(`
          *,
          team:teams(id, name, short_name, abbreviation, color_primary, logo),
          game:games(id, week, home_team, away_team, home_score, away_score, game_utc, status)
        `)
        .eq('playoff_round_id', userRound.id);

      const transformedPicks = (picksData || []).map((p: any) => ({
        ...p,
        team: Array.isArray(p.team) ? p.team[0] : p.team,
        game: Array.isArray(p.game) ? p.game[0] : p.game,
      }));

      const userPicks = transformedPicks.filter((p: PlayoffPick) => p.profile_id === user.id);
      setMyPicks(userPicks);
      setAllPicks(transformedPicks);

      // Load available games for this week WITH team data
      const { data: gamesData } = await supabase
        .from('games')
        .select(`
          *,
          home:teams!games_home_team_fkey(id, name, short_name, abbreviation, color_primary, logo),
          away:teams!games_away_team_fkey(id, name, short_name, abbreviation, color_primary, logo)
        `)
        .eq('season', 2025)
        .eq('week', userRound.week)
        .order('game_utc', { ascending: true });

      const transformedGames = (gamesData || []).map((g: any) => ({
        ...g,
        home: Array.isArray(g.home) ? g.home[0] : g.home,
        away: Array.isArray(g.away) ? g.away[0] : g.away,
      }));

      setGames(transformedGames);

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const handleSelectTeam = async (gameId: string, teamId: string | null) => {
    if (!round || !participant || saving || !teamId) return;

    const game = games.find(g => g.id === gameId);
    if (!game) return;

    setSaving(true);

    // Find next available pick position
    const nextAvailablePosition = [1, 2, 3, 4].find(pos => 
      !myPicks.find(p => p.pick_position === pos) && 
      (isOpenPicks || draftComplete || isPickUnlocked(schedule, participant.seed, pos, now))
    );

    if (!nextAvailablePosition) {
      alert('No available pick positions');
      setSaving(false);
      return;
    }

    const res = await fetch('/api/playoffs/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roundId: round.id,
        gameId,
        teamId,
        pickPosition: nextAvailablePosition,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to save pick');
      setSaving(false);
      return;
    }

    // Reload picks
    const { data: picksData } = await supabase
      .from('playoff_picks_v2')
      .select(`
        *,
        team:teams(id, name, short_name, abbreviation, color_primary, logo),
        game:games(id, week, home_team, away_team, home_score, away_score, game_utc, status)
      `)
      .eq('playoff_round_id', round.id);

    const transformedPicks = (picksData || []).map((p: any) => ({
      ...p,
      team: Array.isArray(p.team) ? p.team[0] : p.team,
      game: Array.isArray(p.game) ? p.game[0] : p.game,
    }));

    const userPicks = transformedPicks.filter((p: PlayoffPick) => p.profile_id === userId);
    setMyPicks(userPicks);
    setAllPicks(transformedPicks);

    setSaving(false);
  };

  const draftComplete = schedule.length === 0 || isDraftComplete(schedule, now);
  const isOpenPicks = round?.round_type === 'consolation' || round?.round_type === 'non_playoff';

  const getRoundTitle = () => {
    if (round?.round_type === 'championship') return 'Championship';
    if (round?.round_type === 'consolation') return 'Consolation (3rd Place)';
    if (round?.round_type === 'semifinal') return 'Semifinals';
    return 'Playoffs';
  };

  if (loading) {
    return (
      <AppShell>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </AppShell>
    );
  }

  if (error || !round || !participant) {
    return (
      <AppShell>
        <Alert severity="error">{error || 'No playoff data available'}</Alert>
      </AppShell>
    );
  }

  // Build taken teams set (only for championship/semifinal rounds)
  const takenTeamIds = new Set<string>();
  if (!isOpenPicks) {
    allPicks.forEach(pick => {
      if (pick.profile_id !== userId) {
        takenTeamIds.add(pick.team_id);
      }
    });
  }

  // TIEBREAKER LOGIC: Filter games based on seed and pick position
  const isTiebreakerGame = (gameId: string) => round.tiebreaker_game_id === gameId;
  const isHigherSeed = participant.seed === 1 || participant.seed === 3;
  const nextPickPosition = [1, 2, 3, 4].find(pos => !myPicks.find(p => p.pick_position === pos));
  const canSelectTiebreaker = isHigherSeed && nextPickPosition === 4;

  // Filter games: hide tiebreaker from lower seeds, show only for higher seeds on 4th pick
  const filteredGames = games.filter(game => {
    if (!isTiebreakerGame(game.id)) return true; // Regular games always show
    
    // Tiebreaker game logic
    if (isOpenPicks) {
      // In consolation/non-playoff: only seed 3 can pick it as 4th pick
      return participant.seed === 3 && nextPickPosition === 4;
    } else {
      // In championship/semifinal: only seed 1 can pick it as 4th pick
      return isHigherSeed && nextPickPosition === 4;
    }
  });

  return (
    <AppShell>
      <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 2, md: 3 } }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <EmojiEvents sx={{ fontSize: 36, color: 'warning.main' }} />
            {getRoundTitle()}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Week {round.week} • {isOpenPicks ? 'Open Picks' : (draftComplete ? 'Open Swaps (1/hour)' : 'Drafting')}
          </Typography>
        </Box>

        {/* Draft Status - Only show for championship/semifinal */}
        {!isOpenPicks && !draftComplete && participant.seed && (
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.main', color: 'white' }}>
            <Typography variant="body2" fontWeight={600}>
              Seed #{participant.seed}
            </Typography>
            <Typography variant="caption">
              {schedule.find(s => isPickUnlocked(schedule, participant.seed, s.pickPosition, now) && 
                !myPicks.find(p => p.pick_position === s.pickPosition))
                ? 'Your pick is unlocked!'
                : 'Wait for your turn...'}
            </Typography>
          </Paper>
        )}

        {/* All Picks Made Alert */}
        {myPicks.length === participant.picks_available && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <CheckCircle sx={{ mr: 1 }} />
            All picks made! {!isOpenPicks && 'You can swap any pick once per hour until games lock.'}
          </Alert>
        )}

        {/* Tiebreaker Info */}
        {isHigherSeed && nextPickPosition === 4 && round.tiebreaker_game_id && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Tiebreaker Available:</strong> As seed #{participant.seed}, the Sunday night game is reserved for your 4th pick. This will be used to break ties.
          </Alert>
        )}

        {/* Playoff Teams */}
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3 }}>
          <EmojiEvents sx={{ fontSize: 20, color: 'warning.main' }} />
          {getRoundTitle()} Teams
        </Typography>

        <Stack spacing={2} sx={{ mb: 4 }}>
          {allParticipants.map((p) => {
            const participantPicks = allPicks.filter(pick => pick.profile_id === p.profile_id);
            const isCurrentUser = p.profile_id === userId;

            return (
              <Paper 
                key={p.id}
                elevation={isCurrentUser ? 3 : 1}
                sx={{ 
                  p: 2, 
                  border: 1,
                  borderColor: isCurrentUser ? 'primary.main' : 'divider',
                  bgcolor: isCurrentUser ? 'action.selected' : 'background.paper',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                  {p.seed && (
                    <Chip 
                      label={`#${p.seed}`} 
                      size="small" 
                      color={isCurrentUser ? 'primary' : 'default'}
                      sx={{ fontWeight: 700 }}
                    />
                  )}
                  <Typography variant="body1" fontWeight={600} sx={{ flexGrow: 1 }}>
                    {p.profile?.display_name || p.profile?.email?.split('@')[0]}
                  </Typography>
                  {isCurrentUser && (
                    <Chip label="YOU" size="small" color="primary" />
                  )}
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {participantPicks.length}/{p.picks_available} picks
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 1 }}>
                  {[1, 2, 3, 4].map((position) => {
                    const pick = participantPicks.find(pick => pick.pick_position === position);
                    const unlocked = isCurrentUser && !pick && participant && 
                      (isOpenPicks || isPickUnlocked(schedule, participant.seed, position, now));
                    const gameLocked = pick?.game ? new Date(pick.game.game_utc) <= now : false;
                    
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
                            ? (gameLocked ? `2px solid ${pick.team?.color_primary}` : '2px solid #4caf50')
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
                          boxShadow: unlocked ? '0 0 8px rgba(66, 165, 245, 0.4)' : 'none',
                        }}
                      >
                        {pick ? (
                          gameLocked ? (
                            <Box
                              component="img"
                              src={pick.team?.logo}
                              alt={pick.team?.abbreviation}
                              sx={{ 
                                width: '70%', 
                                height: '70%', 
                                objectFit: 'contain',
                              }}
                            />
                          ) : (
                            <CheckCircle sx={{ fontSize: 28, color: '#4caf50' }} />
                          )
                        ) : unlocked ? (
                          <LockOpen sx={{ fontSize: 24, color: '#42a5f5' }} />
                        ) : (
                          <Lock sx={{ fontSize: 20, color: 'grey.600' }} />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            );
          })}
        </Stack>

        {/* Game Selection */}
        <Typography variant="h6" gutterBottom>
          Week {round.week} Games
        </Typography>

        <Stack spacing={2}>
          {filteredGames.map((game) => {
            const myPickInGame = myPicks.find(p => p.game_id === game.id);
            const selectedTeamId = myPickInGame?.team_id;
            const isTiebreaker = isTiebreakerGame(game.id);

            return (
              <Box key={game.id} sx={{ position: 'relative' }}>
                {isTiebreaker && (
                  <Chip 
                    label="TIEBREAKER" 
                    color="warning" 
                    size="small" 
                    sx={{ 
                      position: 'absolute', 
                      top: 8, 
                      right: 8, 
                      zIndex: 10,
                      fontWeight: 700 
                    }} 
                  />
                )}
                <PlayoffGameCard
                  game={game}
                  selectedTeamId={selectedTeamId}
                  onSelectTeam={handleSelectTeam}
                  takenTeamIds={takenTeamIds}
                  disabled={saving}
                />
              </Box>
            );
          })}
        </Stack>
      </Box>
    </AppShell>
  );
}
