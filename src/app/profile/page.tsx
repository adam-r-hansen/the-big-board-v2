'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  FormControlLabel,
  Grid,
} from '@mui/material';
import { LightMode, DarkMode, Brightness4, Check } from '@mui/icons-material';
import AppShell from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import { useThemeMode } from '@/theme/ThemeProvider';

type Team = {
  id: string;
  name: string;
  short_name: string;
  abbreviation: string;
  color_primary: string;
  color_secondary: string;
  logo: string;
  conference: string;
  division: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { mode, setMode, refreshTeamColors } = useThemeMode();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile fields
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileColor, setProfileColor] = useState('#1976d2');

  // Team theme
  const [teams, setTeams] = useState<Team[]>([]);
  const [favoriteTeamId, setFavoriteTeamId] = useState<string | null>(null);
  const [useTeamTheme, setUseTeamTheme] = useState(true);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const supabase = createClient();

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      setEmail(user.email || '');

      // Load all teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, short_name, abbreviation, color_primary, color_secondary, logo, conference, division')
        .order('name');
      
      if (teamsData) {
        setTeams(teamsData);
      }

      // Load profile from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, profile_color, theme_preference, favorite_team_id, use_team_theme')
        .eq('id', user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name || '');
        setProfileColor(profile.profile_color || '#1976d2');
        setFavoriteTeamId(profile.favorite_team_id || null);
        setUseTeamTheme(profile.use_team_theme ?? true);
        if (profile.theme_preference) {
          setMode(profile.theme_preference as 'light' | 'dark' | 'auto');
        }
      }

      setLoading(false);
    };

    loadProfile();
  }, [supabase, router, setMode]);

  const handleSelectTeam = async (teamId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setFavoriteTeamId(teamId);

    // Save immediately
    await supabase
      .from('profiles')
      .update({ favorite_team_id: teamId })
      .eq('id', user.id);

    // Refresh theme colors
    await refreshTeamColors();
  };

  const handleToggleTeamTheme = async (enabled: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUseTeamTheme(enabled);

    // Save immediately
    await supabase
      .from('profiles')
      .update({ use_team_theme: enabled })
      .eq('id', user.id);

    // Refresh theme colors
    await refreshTeamColors();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        profile_color: profileColor,
        theme_preference: mode,
      })
      .eq('id', user.id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Profile saved!' });
    }

    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Password updated!' });
      setNewPassword('');
      setConfirmPassword('');
    }

    setSaving(false);
  };

  // Group teams by conference/division
  const groupedTeams = teams.reduce((acc, team) => {
    const key = `${team.conference} ${team.division}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(team);
    return acc;
  }, {} as Record<string, Team[]>);

  const selectedTeam = teams.find(t => t.id === favoriteTeamId);

  if (loading) {
    return (
      <AppShell>
        <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Profile Settings
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        {/* Team Theme Picker */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Favorite Team
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={useTeamTheme}
                  onChange={(e) => handleToggleTeamTheme(e.target.checked)}
                />
              }
              label="Use team colors"
            />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select your favorite team to personalize the app with their colors
          </Typography>

          {/* Selected team preview */}
          {selectedTeam && (
            <Box 
              sx={{ 
                mb: 3, 
                p: 2, 
                borderRadius: 2, 
                bgcolor: useTeamTheme ? selectedTeam.color_primary : 'grey.200',
                color: useTeamTheme ? 'white' : 'text.primary',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                component="img"
                src={selectedTeam.logo}
                alt={selectedTeam.name}
                sx={{ width: 48, height: 48, objectFit: 'contain' }}
              />
              <Box>
                <Typography variant="h6" sx={{ color: 'inherit' }}>
                  {selectedTeam.name}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, color: 'inherit' }}>
                  {selectedTeam.conference} {selectedTeam.division}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleSelectTeam(null)}
                sx={{ 
                  ml: 'auto', 
                  color: 'inherit', 
                  borderColor: 'inherit',
                  '&:hover': { borderColor: 'inherit', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Clear
              </Button>
            </Box>
          )}

          {/* Team grid */}
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {Object.entries(groupedTeams).sort().map(([division, divTeams]) => (
              <Box key={division} sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {division}
                </Typography>
                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                  {divTeams.map((team) => {
                    const isSelected = team.id === favoriteTeamId;
                    return (
                      <Grid size={{ xs: 6, sm: 3 }} key={team.id}>
                        <Box
                          onClick={() => handleSelectTeam(team.id)}
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            border: 2,
                            borderColor: isSelected ? team.color_primary : 'divider',
                            bgcolor: isSelected ? `${team.color_primary}15` : 'background.paper',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            transition: 'all 0.2s',
                            '&:hover': {
                              borderColor: team.color_primary,
                              bgcolor: `${team.color_primary}10`,
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: `linear-gradient(135deg, ${team.color_primary} 50%, ${team.color_secondary} 50%)`,
                              flexShrink: 0,
                            }}
                          />
                          <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                            {team.short_name}
                          </Typography>
                          {isSelected && (
                            <Check sx={{ fontSize: 18, color: team.color_primary }} />
                          )}
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            ))}
          </Box>
        </Paper>

        {/* Profile Info */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Profile
          </Typography>

          <Box component="form" onSubmit={handleSaveProfile}>
            <TextField
              label="Email"
              fullWidth
              disabled
              value={email}
              sx={{ mb: 2 }}
            />

            <TextField
              label="Display Name"
              fullWidth
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              inputProps={{ maxLength: 50 }}
              sx={{ mb: 2 }}
            />

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Profile Color
              </Typography>
              <input
                type="color"
                value={profileColor}
                onChange={(e) => setProfileColor(e.target.value)}
                style={{ width: 60, height: 40, cursor: 'pointer', border: 'none' }}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Theme Preference
              </Typography>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, v) => v && setMode(v)}
                size="small"
              >
                <ToggleButton value="light">
                  <LightMode sx={{ mr: 1 }} /> Light
                </ToggleButton>
                <ToggleButton value="dark">
                  <DarkMode sx={{ mr: 1 }} /> Dark
                </ToggleButton>
                <ToggleButton value="auto">
                  <Brightness4 sx={{ mr: 1 }} /> Auto
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={saving}
            >
              {saving ? <CircularProgress size={24} /> : 'Save Profile'}
            </Button>
          </Box>
        </Paper>

        {/* Password Change */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Change Password
          </Typography>

          <Box component="form" onSubmit={handleChangePassword}>
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              sx={{ mb: 2 }}
            />

            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              sx={{ mb: 2 }}
            />

            <Button
              type="submit"
              variant="outlined"
              disabled={saving || !newPassword || !confirmPassword}
            >
              {saving ? <CircularProgress size={24} /> : 'Update Password'}
            </Button>
          </Box>
        </Paper>
      </Container>
    </AppShell>
  );
}
