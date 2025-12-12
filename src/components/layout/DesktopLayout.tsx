'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Stack, Chip, CircularProgress, Button, Divider } from '@mui/material';
import { Check, Lock, Stars, Group } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NFLScores from './NFLScores';
import Standings from './Standings';

type Pick = {
  id: string;
  week: number;
  team_id: string;
  game_id: string;
  points: number;
  locked_at: string | null;
  profile_id: string;
  team: {
    short_name: string;
    abbreviation: string;
    color_primary: string;
    logo: string;
  };
  game: {
    status: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    game_utc: string;
  };
  profile?: {
    display_name: string;
    profile_color: string;
  };
};

type WrinklePick = {
  id: string;
  wrinkle_id: string;
  team_id: string;
  points: number;
  wrinkle: {
    name: string;
    kind: string;
    week: number;
    league_season_id: string;
    game: {
      status: string;
      home_team: string;
      away_team: string;
      home_score: number | null;
      away_score: number | null;
    };
  };
  team: {
    short_name: string;
    abbreviation: string;
    color_primary: string;
    logo: string;
  };
};

interface Props {
  children: React.ReactNode;
}

export default function DesktopLayout({ children }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weekPicks, setWeekPicks] = useState<Pick[]>([]);
  const [leaguePicks, setLeaguePicks] = useState<Pick[]>([]);
  const [wrinklePicks, setWrinklePicks] = useState<WrinklePick[]>([]);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [weekPoints, setWeekPoints] = useState(0);
  const [leagueSeasonId, setLeagueSeasonId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [allGamesLocked, setAllGamesLocked] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async (leagueId: string) => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Get current week
    const now = new Date();
    const { data: nextGame } = await supabase
      .from('games')
      .select('week')
      .eq('season', 2025)
      .gte('game_utc', now.toISOString())
      .order('game_utc', { ascending: true })
      .limit(1)
      .single();

    const week = nextGame?.week || 1;
    setCurrentWeek(week);

    // Check if all games for the week have started (locked)
    const { data: upcomingGames } = await supabase
      .from('games')
      .select('id')
      .eq('season', 2025)
      .eq('week', week)
      .gte('game_utc', now.toISOString());
    
    setAllGamesLocked(!upcomingGames || upcomingGames.length === 0);

    // Get user's picks with team and game info
    const { data: allPicks } = await supabase
      .from('picks_v2')
      .select(`
        id,
        week,
        team_id,
        game_id,
        points,
        locked_at,
        profile_id,
        team:teams(short_name, abbreviation, color_primary, logo),
        game:games(status, home_team, away_team, home_score, away_score, game_utc)
      `)
      .eq('league_season_id', leagueId)
      .eq('profile_id', user.id);

    let seasonTotal = 0;
    let weekTotal = 0;

    if (allPicks) {
      const picks = allPicks as unknown as Pick[];
      setWeekPicks(picks.filter(p => p.week === week));
      seasonTotal = picks.reduce((sum, p) => sum + (p.points || 0), 0);
      weekTotal = picks.filter(p => p.week === week).reduce((sum, p) => sum + (p.points || 0), 0);
    } else {
      setWeekPicks([]);
    }

    // Get ALL league picks for current week (for league picks section)
    const { data: allLeaguePicks } = await supabase
      .from('picks_v2')
      .select(`
        id,
        week,
        team_id,
        game_id,
        points,
        locked_at,
        profile_id,
        team:teams(short_name, abbreviation, color_primary, logo),
        game:games(status, home_team, away_team, home_score, away_score, game_utc),
        profile:profiles(display_name, profile_color)
      `)
      .eq('league_season_id', leagueId)
      .eq('week', week)
      .neq('profile_id', user.id);

    if (allLeaguePicks) {
      setLeaguePicks(allLeaguePicks as unknown as Pick[]);
    } else {
      setLeaguePicks([]);
    }

    // Get wrinkle picks
    const { data: allWrinklePicks } = await supabase
      .from('wrinkle_picks_v2')
      .select(`
        id,
        wrinkle_id,
        team_id,
        points,
        wrinkle:wrinkles_v2(
          name,
          kind,
          week,
          league_season_id,
          game:games(status, home_team, away_team, home_score, away_score)
        ),
        team:teams(short_name, abbreviation, color_primary, logo)
      `)
      .eq('profile_id', user.id);

    if (allWrinklePicks) {
      const wPicks = allWrinklePicks as unknown as WrinklePick[];
      const filteredWrinklePicks = wPicks.filter(
        p => p.wrinkle?.league_season_id === leagueId && p.wrinkle?.week === week
      );
      setWrinklePicks(filteredWrinklePicks);
      
      const leagueWrinklePicks = wPicks.filter(p => p.wrinkle?.league_season_id === leagueId);
      seasonTotal += leagueWrinklePicks.reduce((sum, p) => sum + (p.points || 0), 0);
      weekTotal += filteredWrinklePicks.reduce((sum, p) => sum + (p.points || 0), 0);
    } else {
      setWrinklePicks([]);
    }

    setSeasonPoints(seasonTotal);
    setWeekPoints(weekTotal);
    setLoading(false);
  }, [supabase]);

  // Initial load
  useEffect(() => {
    const storedLeagueId = localStorage.getItem('activeLeagueSeasonId');
    if (storedLeagueId) {
      setLeagueSeasonId(storedLeagueId);
      loadData(storedLeagueId);
    }
  }, [loadData]);

  // Listen for league changes
  useEffect(() => {
    const handleLeagueChange = (event: CustomEvent) => {
      const newLeagueId = event.detail;
      setLeagueSeasonId(newLeagueId);
      loadData(newLeagueId);
    };

    window.addEventListener('leagueChanged', handleLeagueChange as EventListener);
    return () => window.removeEventListener('leagueChanged', handleLeagueChange as EventListener);
  }, [loadData]);

  const PickCard = ({ pick, showName = false }: { pick: Pick; showName?: boolean }) => {
    const isLocked = !!pick.locked_at || new Date(pick.game.game_utc) < new Date();
    const isComplete = pick.game.status === 'FINAL';
    const isHome = pick.team_id === pick.game.home_team;
    const teamScore = isHome ? pick.game.home_score : pick.game.away_score;
    const oppScore = isHome ? pick.game.away_score : pick.game.home_score;
    const isWinner = isComplete && teamScore !== null && oppScore !== null && teamScore > oppScore;
    const gameTime = new Date(pick.game.game_utc);

    return (
      <Paper
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: pick.team.color_primary,
          color: 'white',
          borderRadius: 2,
          border: isComplete ? 3 : 0,
          borderColor: isWinner ? 'success.main' : 'error.main',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            bgcolor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={pick.team.logo}
            alt={pick.team.short_name}
            sx={{ width: 24, height: 24, objectFit: 'contain' }}
          />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {showName && pick.profile && (
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {pick.profile.display_name}
            </Typography>
          )}
          <Typography variant="body2" fontWeight={600} noWrap>
            {pick.team.short_name}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {isComplete 
              ? `${teamScore} - ${oppScore}` 
              : gameTime.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
            }
          </Typography>
        </Box>
        {isComplete && (
          <Typography variant="body1" fontWeight={700}>
            {isWinner ? `+${pick.points}` : '0'}
          </Typography>
        )}
        {isLocked && !isComplete && <Lock fontSize="small" sx={{ opacity: 0.7 }} />}
      </Paper>
    );
  };

  const WrinklePickCard = ({ pick }: { pick: WrinklePick }) => {
    const isComplete = pick.wrinkle.game.status === 'FINAL';
    const isHome = pick.team_id === pick.wrinkle.game.home_team;
    const teamScore = isHome ? pick.wrinkle.game.home_score : pick.wrinkle.game.away_score;
    const oppScore = isHome ? pick.wrinkle.game.away_score : pick.wrinkle.game.home_score;
    const isWinner = isComplete && teamScore !== null && oppScore !== null && teamScore > oppScore;

    return (
      <Paper
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          border: 2,
          borderColor: 'secondary.main',
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            bgcolor: 'white',
            border: 2,
            borderColor: pick.team.color_primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={pick.team.logo}
            alt={pick.team.short_name}
            sx={{ width: 24, height: 24, objectFit: 'contain' }}
          />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="caption" color="secondary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Stars sx={{ fontSize: 12 }} />
            {pick.wrinkle.name}
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {pick.team.short_name}
          </Typography>
        </Box>
        {isComplete && (
          <Typography variant="body1" fontWeight={700} color={isWinner ? 'success.main' : 'error.main'}>
            {isWinner ? `+${pick.points}` : '0'}
          </Typography>
        )}
      </Paper>
    );
  };

  // Group league picks by user
  const groupedLeaguePicks = leaguePicks.reduce((acc, pick) => {
    const name = pick.profile?.display_name || 'Unknown';
    if (!acc[name]) acc[name] = [];
    acc[name].push(pick);
    return acc;
  }, {} as Record<string, Pick[]>);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left Column - Picks */}
      <Box sx={{ width: 280, p: 2, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Week {currentWeek}
        </Typography>

        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            {/* My Picks */}
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  My Picks
                </Typography>
                <Chip 
                  icon={weekPicks.length >= 2 ? <Check /> : undefined}
                  label={`${weekPicks.length}/2`}
                  size="small"
                  color={weekPicks.length >= 2 ? 'success' : 'default'}
                />
              </Stack>

              {weekPicks.length === 0 ? (
                <Button 
                  variant="outlined" 
                  size="small"
                  fullWidth
                  onClick={() => router.push('/picks')}
                >
                  Make Picks
                </Button>
              ) : (
                <Stack spacing={1}>
                  {weekPicks.map((pick) => (
                    <PickCard key={pick.id} pick={pick} />
                  ))}
                </Stack>
              )}

              {wrinklePicks.length > 0 && (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {wrinklePicks.map((pick) => (
                    <WrinklePickCard key={pick.id} pick={pick} />
                  ))}
                </Stack>
              )}

              {/* Week/Season Points */}
              <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Week</Typography>
                  <Typography variant="body2" fontWeight={600}>{weekPoints} pts</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Season</Typography>
                  <Typography variant="body2" fontWeight={700}>{seasonPoints} pts</Typography>
                </Stack>
              </Paper>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* League Picks */}
            <Box>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                <Group fontSize="small" color="action" />
                <Typography variant="subtitle2" color="text.secondary">
                  League Picks
                </Typography>
              </Stack>

              {!allGamesLocked ? (
                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                  Visible once games lock
                </Typography>
              ) : leaguePicks.length === 0 ? (
                <Typography variant="caption" color="text.disabled">
                  No picks from other members
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {Object.entries(groupedLeaguePicks).map(([name, picks]) => (
                    <Box key={name}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {name}
                      </Typography>
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        {picks.map((pick) => (
                          <PickCard key={pick.id} pick={pick} />
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Center - Main Content (Standings, Stats) */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <Standings />
        <Box sx={{ mt: 3 }}>
          {children}
        </Box>
      </Box>

      {/* Right Column - NFL Scores */}
      <Box sx={{ width: 300, p: 2, borderLeft: 1, borderColor: 'divider', overflow: 'auto' }}>
        <NFLScores />
      </Box>
    </Box>
  );
}
