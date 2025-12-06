'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
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

  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Get user's league season participations
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

          // Check localStorage for last active league
          const lastLeagueId = localStorage.getItem('activeLeagueSeasonId');
          const lastLeague = leagueInfos.find((l: LeagueInfo) => l.id === lastLeagueId);
          setActiveLeague(lastLeague || leagueInfos[0]);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const handleLeagueChange = (league: LeagueInfo) => {
    setActiveLeague(league);
    localStorage.setItem('activeLeagueSeasonId', league.id);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <AppShell 
      userEmail={user?.email}
      leagues={leagues}
      activeLeague={activeLeague}
      onLeagueChange={handleLeagueChange}
    >
      {/* Content will be rendered by the layout based on desktop/mobile */}
    </AppShell>
  );
}
