'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Paper, Stack, Chip, LinearProgress } from '@mui/material';
import { EmojiEvents, TrendingUp, CalendarMonth, People, SportsFootball } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import Standings from '@/components/layout/Standings';
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

            // Load stats for active league
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

            // Get current week
            const { data: games } = await supabase
              .from('games')
              .select('week')
              .eq('season', active.season)
              .order('week', { ascending: false })
              .limit(1);

            if (games && games.length > 0) {
              setCurrentWeek(games[0].week);
            }

            // Get teams remaining
            const { data: picks } = await supabase
              .from('picks_v2')
              .select('team_id')
              .eq('profile_id', user.id)
              .eq('league_season_id', active.id);

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

  const weeksRemaining = 18 - currentWeek;
  const progressPercent = (currentWeek / 18) * 100;

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
            {weeksRemaining} weeks remaining in regular season
          </Typography>
        </Paper>

        {/* Your Stats */}
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

        {/* Standings */}
        <Standings />
      </Box>
    </AppShell>
  );
}
