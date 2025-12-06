'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
  Button,
  Chip,
} from '@mui/material';
import { 
  LightMode, 
  DarkMode, 
  Brightness4,
  Person,
  KeyboardArrowDown,
} from '@mui/icons-material';
import { useThemeMode } from '@/theme/ThemeProvider';
import { createClient } from '@/lib/supabase/client';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';

type LeagueInfo = {
  id: string;
  league_id: string;
  season: number;
  leagues_v2: {
    id: string;
    name: string;
  };
};

interface Props {
  children: React.ReactNode;
  userEmail?: string;
  leagues?: LeagueInfo[];
  activeLeague?: LeagueInfo | null;
  onLeagueChange?: (league: LeagueInfo) => void;
}

export default function AppShell({ 
  children, 
  userEmail,
  leagues = [],
  activeLeague,
  onLeagueChange,
}: Props) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const { mode, setMode } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [leagueAnchorEl, setLeagueAnchorEl] = useState<null | HTMLElement>(null);

  const supabase = createClient();

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLeagueMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (leagues.length > 1) {
      setLeagueAnchorEl(event.currentTarget);
    }
  };

  const handleLeagueClose = () => {
    setLeagueAnchorEl(null);
  };

  const handleLeagueSelect = (league: LeagueInfo) => {
    onLeagueChange?.(league);
    handleLeagueClose();
  };

  const handleProfile = () => {
    handleClose();
    router.push('/profile');
  };

  const handleLogout = async () => {
    handleClose();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  const cycleTheme = () => {
    const modes: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto'];
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  const ThemeIcon = mode === 'light' ? LightMode : mode === 'dark' ? DarkMode : Brightness4;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top App Bar */}
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <Typography 
            variant="h6" 
            sx={{ fontWeight: 700, cursor: 'pointer', mr: 2 }}
            onClick={() => router.push('/')}
          >
            The Big Board
          </Typography>

          {/* League Switcher */}
          {activeLeague && (
            <Button
              color="inherit"
              onClick={handleLeagueMenu}
              endIcon={leagues.length > 1 ? <KeyboardArrowDown /> : undefined}
              sx={{ textTransform: 'none' }}
            >
              {activeLeague.leagues_v2.name}
              <Chip 
                label={activeLeague.season} 
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
            {leagues.map((league) => (
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
            <MenuItem onClick={handleLogout}>Sign Out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Main Content - Desktop or Mobile Layout */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {isMobile ? (
          <MobileLayout>{children}</MobileLayout>
        ) : (
          <DesktopLayout>{children}</DesktopLayout>
        )}
      </Box>
    </Box>
  );
}
