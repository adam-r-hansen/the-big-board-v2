'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Chip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  LightMode,
  DarkMode,
  Brightness4,
  Person,
  KeyboardArrowDown,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import { useThemeMode } from '@/theme/ThemeProvider';
import MobileLayout from './MobileLayout';
import DesktopLayout from './DesktopLayout';

interface League {
  id: string;
  season: number;
  leagues_v2: {
    id: string;
    name: string;
  };
}

interface Props {
  children: ReactNode;
  leagues?: League[];
  activeLeague?: League;
}

export default function AppShell({ children, leagues: propsLeagues, activeLeague: propsActiveLeague }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { mode, setMode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [leagueAnchorEl, setLeagueAnchorEl] = useState<null | HTMLElement>(null);
  const [userEmail, setUserEmail] = useState('');

  // Internal state for leagues if not provided via props
  const [internalLeagues, setInternalLeagues] = useState<League[]>([]);
  const [internalActiveLeague, setInternalActiveLeague] = useState<League | null>(null);

  const supabase = createClient();

  // Use props if provided, otherwise use internal state
  const leagues = propsLeagues || internalLeagues;
  const activeLeague = propsActiveLeague || internalActiveLeague;

  // Cycle theme function
  const cycleTheme = () => {
    const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light';
    setMode(next);
  };

  // Load leagues and active league if not provided via props
  useEffect(() => {
    if (propsLeagues && propsActiveLeague) return; // Skip if provided via props

    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');

        // Load leagues
        const { data: leaguesData } = await supabase
          .from('league_season_participants_v2')
          .select(`
            league_season:league_seasons_v2(
              id,
              season,
              leagues_v2(id, name)
            )
          `)
          .eq('profile_id', user.id)
          .eq('active', true);

        const flatLeagues = (leaguesData || [])
          .map((p: any) => p.league_season)
          .filter(Boolean);

        setInternalLeagues(flatLeagues);

        // Set active league from localStorage or default to first
        const storedLeagueId = localStorage.getItem('activeLeagueSeasonId');
        const active = flatLeagues.find((l: League) => l.id === storedLeagueId) || flatLeagues[0];
        if (active) {
          setInternalActiveLeague(active);
          localStorage.setItem('activeLeagueSeasonId', active.id);
        }
      }
    };

    loadData();
  }, [supabase, propsLeagues, propsActiveLeague]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
      }
    };
    loadUser();
  }, [supabase]);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    handleClose();
  };

  const handleProfile = () => {
    router.push('/profile');
    handleClose();
  };

  const handleAdmin = () => {
    router.push('/admin');
    handleClose();
  };

  const handleLeagueMenu = (event: React.MouseEvent<HTMLElement>) => {
    setLeagueAnchorEl(event.currentTarget);
  };

  const handleLeagueClose = () => {
    setLeagueAnchorEl(null);
  };

  const handleLeagueSelect = (league: League) => {
    setInternalActiveLeague(league);
    localStorage.setItem('activeLeagueSeasonId', league.id);
    handleLeagueClose();
    // Refresh the page to load new league data
    window.location.reload();
  };

  const ThemeIcon = mode === 'light' ? LightMode : mode === 'dark' ? DarkMode : Brightness4;

  const isPicksPage = pathname?.startsWith('/picks');
  const isPlayoffsPage = pathname?.startsWith('/playoffs');
  const showLeagueSelector = leagues.length > 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{ cursor: 'pointer', fontWeight: 700 }}
            onClick={() => router.push('/')}
          >
            The Big Board
          </Typography>

          {/* League Selector (only show if multiple leagues) */}
          {showLeagueSelector && activeLeague && (
            <Button
              color="inherit"
              onClick={handleLeagueMenu}
              endIcon={<KeyboardArrowDown />}
              sx={{ textTransform: 'none' }}
            >
              {internalActiveLeague?.leagues_v2?.name}
              <Chip 
                label={internalActiveLeague?.season} 
                size="small" 
                sx={{ ml: 1, height: 20, bgcolor: 'rgba(255,255,255,0.2)' }} 
              />
            </Button>
          )}

          <Menu
            anchorEl={leagueAnchorEl}
            open={Boolean(leagueAnchorEl)}
            onClose={handleLeagueClose}
          >
            {internalLeagues.map((league) => (
              <MenuItem 
                key={league.id}
                onClick={() => handleLeagueSelect(league)}
                selected={league.id === activeLeague?.id}
              >
                {league.leagues_v2.name}
                <Chip 
                  label={league.season} 
                  size="small" 
                  sx={{ ml: 1, height: 20 }} 
                />
              </MenuItem>
            ))}
          </Menu>

          {/* Nav Links */}
          <Button
            color="inherit"
            onClick={() => router.push('/picks')}
            sx={{ 
              ml: 2,
              fontWeight: isPicksPage ? 700 : 400,
              borderBottom: isPicksPage ? '2px solid white' : 'none',
              borderRadius: 0,
            }}
          >
            Make Picks
          </Button>

          
          <Button
            color="inherit"
            onClick={() => router.push('/playoffs')}
            sx={{
              ml: 2,
              fontWeight: isPlayoffsPage ? 700 : 400,
              borderBottom: isPlayoffsPage ? '2px solid white' : 'none',
              borderRadius: 0,
            }}
          >
            Playoffs
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <IconButton color="inherit" onClick={cycleTheme} title={`Theme: ${mode}`}>
            <ThemeIcon />
          </IconButton>

          <IconButton color="inherit" onClick={handleMenu}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              <Person fontSize="small" />
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {userEmail}
              </Typography>
            </MenuItem>
            <MenuItem onClick={handleProfile}>Profile</MenuItem>
            <MenuItem onClick={handleAdmin}>Admin</MenuItem>
            <MenuItem onClick={handleLogout}>Sign Out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Main Content - Desktop or Mobile Layout */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {isPicksPage ? (
          children
        ) : isPlayoffsPage ? (
          children
        ) : isMobile ? (
          <MobileLayout>{children}</MobileLayout>
        ) : (
          <DesktopLayout>{children}</DesktopLayout>
        )}
      </Box>
    </Box>
  );
}
