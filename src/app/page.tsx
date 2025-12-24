'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Paper, Stack, Chip, LinearProgress } from '@mui/material';
import { EmojiEvents, TrendingUp, CalendarMonth, People, SportsFootball, Lock, LockOpen, CheckCircle } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import Standings from '@/components/layout/Standings';
import { isPickUnlocked, isDraftComplete, generateUnlockSchedule } from '@/lib/playoffs/unlockSchedule';
import type { User } from '@supabase/supabase-js';

type LeagueInfo = {
  id: string;
  league_id: string;
  season: number;
  playoffs_enabled?: boolean;
  leagues_v2: {
    id: string;
    name: string;
  };
};

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
  game_utc: string;
};

type PlayoffPick = {
  id: string;
  profile_id: string;
  team_id: string;
  pick_position: number;
  game_id: string;
  team?: Team;
  game?: Game;
};

type PlayoffParticipant = {
  id: string;
  profile_id: string;
  seed: number;
  picks_available: number;
  profile?: {
    display_name: string;
    email: string;
  };
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [activeLeague, setActiveLeague] = useState<LeagueInfo | null>(null);
  
  // Dashboard stats
  const [currentWeek, setCurrentWeek] = useState(17);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalMembers, setTotalMembers] = useState(1);
  const [teamsRemaining, setTeamsRemaining] = useState(32);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [isPlayoffs, setIsPlayoffs] = useState(false);
  
  // Playoff data
  const [playoffParticipants, setPlayoffParticipants] = useState<PlayoffParticipant[]>([]);
  const [playoffPicks, setPlayoffPicks] = useState<PlayoffPick[]>([]);
  const [draftStartTime, setDraftStartTime] = useState<Date | null>(null);
  const [roundType, setRoundType] = useState<'semifinal' | 'championship'>('semifinal');
  const [now] = useState(new Date());

  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: participants } = await supabase
          .from('league_season_participants_v2')
          .select(`
            id,
            league_season_id,
            league_seasons_v2 (
              id,
              league_id,
              season,
              playoffs_enabled,
              leagues_v2 (
                id,
                name
              )
            )
          `)
          .eq('profile_id', user.id)
          .eq('active', true);

        if (participants && participants.length > 0) {
          const leagueList = participants
            .map((p: any) => p.league_seasons_v2)
            .filter(Boolean);
          
          setLeagues(leagueList);

          const storedLeagueId = localStorage.getItem('activeLeagueSeasonId');
          const active = leagueList.find((l: LeagueInfo) => l.id === storedLeagueId) || leagueList[0];
          
          if (active) {
            setActiveLeague(active);
            localStorage.setItem('activeLeagueSeasonId', active.id);

            // Check if we're in playoffs (Week 17+)
            const { data: games } = await supabase
              .from('games')
              .select('week')
              .eq('season', active.season)
              .order('week', { ascending: false })
              .limit(1);

            const latestWeek = games?.[0]?.week || 17;
            setCurrentWeek(latestWeek);
            const playoffsActive = latestWeek >= 17 && active.playoffs_enabled;
            setIsPlayoffs(playoffsActive);

            // If playoffs are active, load playoff data
            if (playoffsActive) {
              const { data: roundData } = await supabase
                .from('playoff_rounds_v2')
                .select('id, draft_start_time, round_type')
                .eq('league_season_id', active.id)
                .eq('week', latestWeek)
                .single();

              if (roundData) {
                setDraftStartTime(roundData.draft_start_time ? new Date(roundData.draft_start_time) : null);
                setRoundType(roundData.round_type as 'semifinal' | 'championship');

                // Load playoff participants
                const { data: participantsData } = await supabase
                  .from('playoff_participants_v2')
                  .select(`
                    id,
                    profile_id,
                    seed,
                    picks_available,
                    profile:profiles!playoff_participants_v2_profile_id_fkey(display_name, email)
                  `)
                  .eq('playoff_round_id', roundData.id)
                  .lte('seed', 4)
                  .order('seed', { ascending: true });

                // Transform to match type (profile comes as array from Supabase)
                const transformedParticipants = (participantsData || []).map((p: any) => ({
                  ...p,
                  profile: Array.isArray(p.profile) ? p.profile[0] : p.profile
                }));

                setPlayoffParticipants(transformedParticipants);

                // Load all playoff picks with game data
                const { data: picksData } = await supabase
                  .from('playoff_picks_v2')
                  .select(`
                    id,
                    profile_id,
                    team_id,
                    pick_position,
                    game_id,
                    team:teams(id, name, short_name, abbreviation, color_primary, logo),
                    game:games(id, game_utc)
                  `)
                  .eq('playoff_round_id', roundData.id);

                setPlayoffPicks(picksData || []);
              }
            }

            // Load regular season stats
            const { data: standings } = await supabase
              .from('standings_v2')
              .select('*')
              .eq('league_season_id', active.id)
              .order('rank', { ascending: true });

            if (standings) {
              const userStanding = standings.find((s: any) => s.profile_id === user.id);
              setUserRank(userStanding?.rank || null);
              setSeasonPoints(userStanding?.total_points || 0);
              setTotalMembers(standings.length);
            }

            // Get teams remaining (through regular season only)
            const { data: picks } = await supabase
              .from('picks_v2')
              .select('team_id, week')
              .eq('profile_id', user.id)
              .eq('league_season_id', active.id)
              .lte('week', 16);

            const usedTeams = new Set(picks?.map((p: any) => p.team_id) || []);
            setTeamsRemaining(32 - usedTeams.size);
          }
        }
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const handleLeagueChange = (league: LeagueInfo) => {
    setActiveLeague(league);
    localStorage.setItem('activeLeagueSeasonId', league.id);
    window.location.reload();
  };

  if (loading) {
    return (
      <AppShell userEmail={user?.email} leagues={leagues} activeLeague={activeLeague}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </AppShell>
    );
  }

  const regularSeasonWeeks = 16;
  const weeksRemaining = Math.max(0, regularSeasonWeeks - currentWeek);
  const progressPercent = Math.min(100, (currentWeek / regularSeasonWeeks) * 100);

  // Check if a pick is unlocked for a user
  const isPickUnlockedForUser = (participant: PlayoffParticipant, pickPosition: number): boolean => {
    if (!draftStartTime) return false;
    const schedule = generateUnlockSchedule(currentWeek as 17 | 18, draftStartTime, roundType);
    const draftComplete = isDraftComplete(schedule, now);
    if (draftComplete) return true;
    return isPickUnlocked(schedule, participant.seed, pickPosition, now);
  };

  // Check if game has started/locked
  const isGameLocked = (pick: PlayoffPick): boolean => {
    if (!pick.game?.game_utc) return false;
    return new Date(pick.game.game_utc) <= now;
  };

  return (
    <AppShell 
      userEmail={user?.email} 
      leagues={leagues} 
      activeLeague={activeLeague}
      onLeagueChange={handleLeagueChange}
    >
      <Box sx={{ flexGrow: 1, p: 3 }}>
        {/* Season Progress */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonth />
            Season Progress
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progressPercent} 
            sx={{ height: 10, borderRadius: 5, mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary">
            {isPlayoffs 
              ? 'Regular season complete • Playoffs underway' 
              : `${weeksRemaining} weeks remaining in regular season`
            }
          </Typography>
        </Paper>

        {/* Playoff Participants (if playoffs active) */}
        {isPlayoffs && playoffParticipants.length > 0 && (
          <>
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
              {playoffParticipants.map((participant) => {
                const participantPicks = playoffPicks.filter(p => p.profile_id === participant.profile_id);
                const isCurrentUser = participant.profile_id === user?.id;

                return (
                  <Paper 
                    key={participant.id}
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
                        label={`#${participant.seed}`} 
                        size="small" 
                        color={isCurrentUser ? 'primary' : 'default'}
                        sx={{ fontWeight: 700 }}
                      />
                      <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }} noWrap>
                        {participant.profile?.display_name || participant.profile?.email?.split('@')[0]}
                      </Typography>
                      {isCurrentUser && (
                        <Typography variant="caption" color="primary.main" fontWeight={600}>
                          YOU
                        </Typography>
                      )}
                    </Stack>

                    {/* Pick Progress */}
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      {participantPicks.length}/{participant.picks_available} picks made
                    </Typography>

                    {/* Picks Grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
                      {[1, 2, 3, 4].map((position) => {
                        const pick = participantPicks.find(p => p.pick_position === position);
                        const unlocked = isCurrentUser && !pick && isPickUnlockedForUser(participant, position);
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
          </>
        )}

        {/* Regular Stats (shown for non-playoff leagues) */}
        {!isPlayoffs && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
              Your Stats
            </Typography>
            
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 3
            }}>
              <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                <EmojiEvents sx={{ fontSize: 48, color: 'warning.main', mb: 1 }} />
                <Typography variant="h3" fontWeight={700}>
                  #{userRank || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current Rank
                </Typography>
              </Paper>

              <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                <TrendingUp sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                <Typography variant="h3" fontWeight={700}>
                  {seasonPoints}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Season Points
                </Typography>
              </Paper>

              <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                <People sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
                <Typography variant="h3" fontWeight={700}>
                  {totalMembers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Members
                </Typography>
              </Paper>

              <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                <SportsFootball sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h3" fontWeight={700}>
                  {teamsRemaining}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Teams Left
                </Typography>
              </Paper>
            </Box>
          </>
        )}

        {/* Standings */}
        <Standings />
      </Box>
    </AppShell>
  );
}
