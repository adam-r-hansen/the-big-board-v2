'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { ThemeProvider as MUIThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createLightTheme, createDarkTheme, TeamColors } from './theme';
import { createClient } from '@/lib/supabase/client';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedMode: 'light' | 'dark';
  teamColors: TeamColors;
  setTeamColors: (colors: TeamColors) => void;
  refreshTeamColors: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
}

interface Props {
  children: ReactNode;
}

type TeamRow = {
  color_primary: string | null;
  color_secondary: string | null;
};

export default function ThemeProvider({ children }: Props) {
  const [mode, setMode] = useState<ThemeMode>('auto');
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');
  const [teamColors, setTeamColors] = useState<TeamColors>(null);
  const [mounted, setMounted] = useState(false);

  const supabase = createClient();

  // Load team colors from user profile
  const refreshTeamColors = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setTeamColors(null);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('use_team_theme, favorite_team_id, teams!favorite_team_id(color_primary, color_secondary)')
        .eq('id', user.id)
        .single();

      // Supabase relationship selects often come back as an array.
      // Support array OR object here to keep TS + runtime happy.
      const rawTeams = (profile as any)?.teams as TeamRow[] | TeamRow | null | undefined;
      const team: TeamRow | null =
        Array.isArray(rawTeams) ? rawTeams[0] ?? null : rawTeams ?? null;

      if (profile?.use_team_theme && team?.color_primary && team?.color_secondary) {
        console.log('Setting team colors:', { primary: team.color_primary, secondary: team.color_secondary });
        setTeamColors({
          primary: team.color_primary,
          secondary: team.color_secondary,
        });
      } else {
        console.log('Clearing team colors');
        setTeamColors(null);
      }
    } catch (error) {
      console.error('Error loading team colors:', error);
      setTeamColors(null);
    }
  }, [supabase]);

  // Initial load
  useEffect(() => {
    setMounted(true);

    // Load saved theme preference
    const saved = localStorage.getItem('themeMode') as ThemeMode | null;
    if (saved) {
      setMode(saved);
    }

    // Load team colors
    refreshTeamColors();

    // Listen for auth changes to reload team colors
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        refreshTeamColors();
      } else if (event === 'SIGNED_OUT') {
        setTeamColors(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshTeamColors]);

  // Handle system preference detection
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mode === 'auto') {
        setResolvedMode(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode, mounted]);

  // Resolve the actual theme based on mode
  useEffect(() => {
    if (!mounted) return;

    if (mode === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setResolvedMode(prefersDark ? 'dark' : 'light');
    } else {
      setResolvedMode(mode);
    }
  }, [mode, mounted]);

  // Save preference when changed
  const handleSetMode = (newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem('themeMode', newMode);
  };

  // Create theme with team colors
  const theme = useMemo(
    () => (resolvedMode === 'dark' ? createDarkTheme(teamColors) : createLightTheme(teamColors)),
    [resolvedMode, teamColors]
  );

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode: handleSetMode,
        resolvedMode,
        teamColors,
        setTeamColors,
        refreshTeamColors,
      }}
    >
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
}
