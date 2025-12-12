'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Paper, Stack, Chip, LinearProgress } from '@mui/material';
import { EmojiEvents, TrendingUp, CalendarMonth, People, SportsFootball } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import type { User } from '@supabase/supabase-js';

type LeagueInfo = {
  id: string;
  league_id: string;
  season: number;
  leagues_v2: {
    id: string;
    name: string;
  };
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [activeLeague, setActiveLeague] = useState<LeagueInfo | null>(null);
  
  // Dashboard stats
  const [currentWeek, setCurrentWeek] = useState(14);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalMembers, setTotalMembers] = useState(1);
  const [teamsRemaining, setTeamsRemaining] = useState(32);
  const [seasonPoints, setSeasonPoints] = useState(0);

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
              leagues_v2 (
                id,
                name
              )
            )
          `)
          .eq('profile_id', user.id)
          .eq('active', true);

        if (participants && participants.length > 0) {
          const leagueInfos = participants.map((p: any) => ({
            id: p.league_seasons_v2.id,
            league_id: p.league_seasons_v2.league_id,
            season: p.league_seasons_v2.season,
            leagues_v2: p.league_seasons_v2.leagues_v2,
          }));
          setLeagues(leagueInfos);

          const lastLeagueId = localStorage.getItem('activeLeagueSeasonId');
          const lastLeague = leagueInfos.find((l: LeagueInfo) => l.id === lastLeagueId);
          const active = lastLeague || leagueInfos[0];
          setActiveLeague(active);
          
          await loadDashboardStats(user.id, active.id);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const loadDashboardStats = async (userId: string, leagueSeasonId: string) => {
    const now = new Date();
    const { data: nextGame } = await supabase
      .from('games')
      .select('week')
      .eq('season', 2025)
      .gte('game_utc', now.toISOString())
      .order('game_utc', { ascending: true })
      .limit(1)
      .single();

    const week = nextGame?.week || 14;
    setCurrentWeek(week);

    const { count } = await supabase
      .from('league_season_participants_v2')
      .select('*', { count: 'exact', head: true })
      .eq('league_season_id', leagueSeasonId)
      .eq('active', true);

    setTotalMembers(count || 1);

    const { data: userPicks } = await supabase
      .from('picks_v2')
      .select('team_id, points')
      .eq('league_season_id', leagueSeasonId)
      .eq('profile_id', userId);

    if (userPicks) {
      const usedTeamCount = new Set(userPicks.map(p => p.team_id)).size;
      setTeamsRemaining(32 - usedTeamCount);
      setSeasonPoints(userPicks.reduce((sum, p) => sum + (p.points || 0), 0));
    }

    const { data: allPicks } = await supabase
      .from('picks_v2')
      .select('profile_id, points')
      .eq('league_season_id', leagueSeasonId);

    if (allPicks) {
      const pointsMap = new Map<string, number>();
      allPicks.forEach(pick => {
        const current = pointsMap.get(pick.profile_id) || 0;
        pointsMap.set(pick.profile_id, current + (pick.points || 0));
      });
      const sorted = Array.from(pointsMap.entries()).sort((a, b) => b[1] - a[1]);
      const rank = sorted.findIndex(([id]) => id === userId) + 1;
      setUserRank(rank || null);
    }
  };

  const handleLeagueChange = async (league: LeagueInfo) => {
    setActiveLeague(league);
    localStorage.setItem('activeLeagueSeasonId', league.id);
    window.dispatchEvent(new Event('leagueChanged'));
    if (user) {
      await loadDashboardStats(user.id, league.id);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const seasonProgress = Math.round((currentWeek / 18) * 100);

  return (
    <AppShell 
      userEmail={user?.email}
      leagues={leagues}
      activeLeague={activeLeague}
      onLeagueChange={handleLeagueChange}
    >
      <Box>
        {/* Season Progress Card */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Season Progress
            </Typography>
            <Chip 
              icon={<CalendarMonth />} 
              label={`Week ${currentWeek} of 18`} 
              size="small" 
              color="primary" 
            />
          </Stack>
          <LinearProgress 
            variant="determinate" 
            value={seasonProgress} 
            sx={{ height: 8, borderRadius: 4 }} 
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {18 - currentWeek} weeks remaining in regular season
          </Typography>
        </Paper>

        {/* Quick Stats */}
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Your Stats
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          <Paper sx={{ p: 2.5, textAlign: 'center' }}>
            <EmojiEvents sx={{ fontSize: 36, color: 'warning.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>
              {userRank ? `#${userRank}` : '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Current Rank
            </Typography>
          </Paper>
          
          <Paper sx={{ p: 2.5, textAlign: 'center' }}>
            <SportsFootball sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>
              {teamsRemaining}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Teams Left
            </Typography>
          </Paper>
          
          <Paper sx={{ p: 2.5, textAlign: 'center' }}>
            <TrendingUp sx={{ fontSize: 36, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>
              {seasonPoints}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Points
            </Typography>
          </Paper>
        </Box>

        {/* League Info */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 2 }}>
            <People color="action" />
            <Typography variant="h6" fontWeight={600}>
              League Info
            </Typography>
          </Stack>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">League</Typography>
              <Typography fontWeight={600}>{activeLeague?.leagues_v2?.name}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">Season</Typography>
              <Typography fontWeight={600}>{activeLeague?.season}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">Members</Typography>
              <Typography fontWeight={600}>{totalMembers}</Typography>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </AppShell>
  );
}
