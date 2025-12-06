'use client';

import { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Chip,
  Avatar,
} from '@mui/material';
import { AccountCircle, DarkMode, LightMode, KeyboardArrowDown } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type LeagueSeason = {
  id: string;
  season: number;
  league: {
    id: string;
    name: string;
  };
};

export default function Header() {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [leagueAnchorEl, setLeagueAnchorEl] = useState<null | HTMLElement>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [leagues, setLeagues] = useState<LeagueSeason[]>([]);
  const [activeLeague, setActiveLeague] = useState<LeagueSeason | null>(null);
  const [userProfile, setUserProfile] = useState<{ display_name: string; profile_color: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, profile_color')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
      }

      // Load user's leagues
      const { data: memberships } = await supabase
        .from('league_season_participants_v2')
        .select(`
          league_season:league_seasons_v2(
            id,
            season,
            league:leagues_v2(id, name)
          )
        `)
        .eq('profile_id', user.id)
        .eq('active', true);

      if (memberships) {
        const leagueSeasons = memberships
          .map((m: any) => m.league_season)
          .filter(Boolean)
          .map((ls: any) => ({
            id: ls.id,
            season: ls.season,
            league: ls.league,
          }));

        setLeagues(leagueSeasons);

        // Set active league from localStorage or first league
        const storedLeagueId = localStorage.getItem('activeLeagueSeasonId');
        const active = leagueSeasons.find((ls) => ls.id === storedLeagueId) || leagueSeasons[0];
        if (active) {
          setActiveLeague(active);
          localStorage.setItem('activeLeagueSeasonId', active.id);
        }
      }
    };

    loadData();
  }, [supabase]);

  const handleLeagueChange = (league: LeagueSeason) => {
    setActiveLeague(league);
    localStorage.setItem('activeLeagueSeasonId', league.id);
    setLeagueAnchorEl(null);
    
    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent('leagueChanged', { detail: league.id }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <AppBar position="sticky" elevation={1}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ cursor: 'pointer', fontWeight: 700 }}
          onClick={() => router.push('/')}
        >
          The Big Board
        </Typography>

        {/* League Switcher */}
        {activeLeague && (
          <Button
            color="inherit"
            onClick={(e) => setLeagueAnchorEl(e.currentTarget)}
            endIcon={<KeyboardArrowDown />}
            sx={{ ml: 2, textTransform: 'none' }}
          >
            {activeLeague.league.name}
            <Chip label={activeLeague.season} size="small" sx={{ ml: 1, height: 20 }} />
          </Button>
        )}
        <Menu
          anchorEl={leagueAnchorEl}
          open={Boolean(leagueAnchorEl)}
          onClose={() => setLeagueAnchorEl(null)}
        >
          {leagues.map((league) => (
            <MenuItem
              key={league.id}
              selected={league.id === activeLeague?.id}
              onClick={() => handleLeagueChange(league)}
            >
              {league.league.name} ({league.season})
            </MenuItem>
          ))}
        </Menu>

        {/* Nav Links */}
        <Button color="inherit" onClick={() => router.push('/picks')} sx={{ ml: 2 }}>
          Make Picks
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        {/* Dark Mode Toggle */}
        <IconButton color="inherit" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? <LightMode /> : <DarkMode />}
        </IconButton>

        {/* User Menu */}
        <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
          {userProfile ? (
            <Avatar sx={{ width: 32, height: 32, bgcolor: userProfile.profile_color }}>
              {userProfile.display_name?.charAt(0).toUpperCase()}
            </Avatar>
          ) : (
            <AccountCircle />
          )}
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={() => { setAnchorEl(null); router.push('/profile'); }}>
            Profile
          </MenuItem>
          <MenuItem onClick={() => { setAnchorEl(null); router.push('/admin'); }}>
            Admin
          </MenuItem>
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
