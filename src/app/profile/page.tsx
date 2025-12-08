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
} from '@mui/material';
import { LightMode, DarkMode, Brightness4 } from '@mui/icons-material';
import AppShell from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import { useThemeMode } from '@/theme/ThemeProvider';

export default function ProfilePage() {
  const router = useRouter();
  const { mode, setMode } = useThemeMode();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile fields
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileColor, setProfileColor] = useState('#1976d2');

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

      // Load profile from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, profile_color, theme_preference')
        .eq('id', user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name || '');
        setProfileColor(profile.profile_color || '#1976d2');
        if (profile.theme_preference) {
          setMode(profile.theme_preference as 'light' | 'dark' | 'auto');
        }
      }

      setLoading(false);
    };

    loadProfile();
  }, [supabase, router, setMode]);

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
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Profile Settings
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }}>
            {message.text}
          </Alert>
        )}

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
