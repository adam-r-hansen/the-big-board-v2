'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Stack,
  Divider,
} from '@mui/material';
import { ArrowBack, EmojiEvents } from '@mui/icons-material';
import AppShell from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';

export default function AdminPlayoffsPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueSeasonId, setSelectedLeagueSeasonId] = useState('');
  const [playoffSettings, setPlayoffSettings] = useState<any>(null);
  const [playoffsEnabled, setPlayoffsEnabled] = useState(false);
  const [regularSeasonWeeks, setRegularSeasonWeeks] = useState(16);

  // Load leagues
  useEffect(() => {
    const loadLeagues = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      // Get user's profile to check if admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      // Only Adam can access admin
      if (profile?.display_name !== 'Adam!') {
        router.push('/');
        return;
      }

      // Get all league seasons
      const { data: leagueSeasons } = await supabase
        .from('league_seasons_v2')
        .select('*, league:leagues_v2(name)')
        .order('season', { ascending: false });

      setLeagues(leagueSeasons || []);
      setLoading(false);
    };

    loadLeagues();
  }, []);

  // Load playoff settings when league is selected
  useEffect(() => {
    if (!selectedLeagueSeasonId) return;

    const loadSettings = async () => {
      const res = await fetch(`/api/playoffs/settings?leagueSeasonId=${selectedLeagueSeasonId}`);
      const data = await res.json();
      
      setPlayoffSettings(data);
      setPlayoffsEnabled(data.enabled || false);
      setRegularSeasonWeeks(data.regular_season_weeks || 16);
    };

    loadSettings();
  }, [selectedLeagueSeasonId]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/playoffs/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueSeasonId: selectedLeagueSeasonId,
          enabled: playoffsEnabled,
          regularSeasonWeeks,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      } else {
        setMessage({ type: 'success', text: 'Playoff settings saved!' });
        setPlayoffSettings(data);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    }

    setSaving(false);
  };

  const handleInitializeWeek17 = async () => {
    setInitializing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/playoffs/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueSeasonId: selectedLeagueSeasonId,
          week: 17,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to initialize Week 17' });
      } else {
        setMessage({ type: 'success', text: 'Week 17 initialized successfully!' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    }

    setInitializing(false);
  };

  if (loading) {
    return (
      <AppShell>
        <Container sx={{ py: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => router.push('/admin')}
          sx={{ mb: 2 }}
        >
          Back to Admin
        </Button>

        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <EmojiEvents sx={{ fontSize: 40, color: 'warning.main' }} />
          <Typography variant="h4" fontWeight={700}>
            Manage Playoffs
          </Typography>
        </Stack>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select League
          </Typography>
          <FormControl fullWidth>
            <InputLabel>League Season</InputLabel>
            <Select
              value={selectedLeagueSeasonId}
              onChange={(e) => setSelectedLeagueSeasonId(e.target.value)}
              label="League Season"
            >
              {leagues.map((ls) => (
                <MenuItem key={ls.id} value={ls.id}>
                  {ls.league?.name} - {ls.season}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        {selectedLeagueSeasonId && playoffSettings && (
          <>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Playoff Settings
              </Typography>

              <Stack spacing={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={playoffsEnabled}
                      onChange={(e) => setPlayoffsEnabled(e.target.checked)}
                    />
                  }
                  label="Enable Playoffs"
                />

                <FormControl fullWidth>
                  <InputLabel>Regular Season Weeks</InputLabel>
                  <Select
                    value={regularSeasonWeeks}
                    onChange={(e) => setRegularSeasonWeeks(Number(e.target.value))}
                    label="Regular Season Weeks"
                  >
                    {[14, 15, 16, 17, 18].map((week) => (
                      <MenuItem key={week} value={week}>
                        {week} weeks
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  onClick={handleSaveSettings}
                  disabled={saving}
                  fullWidth
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </Stack>
            </Paper>

            {playoffsEnabled && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Manual Controls
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Use these controls to manually initialize playoff rounds (normally happens automatically via GitHub Action)
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Initialize Week 17 (Semifinals)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Creates semifinal and non-playoff rounds, seeds top 4 players
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={handleInitializeWeek17}
                      disabled={initializing}
                      fullWidth
                    >
                      {initializing ? 'Initializing...' : 'Initialize Week 17'}
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            )}
          </>
        )}
      </Container>
    </AppShell>
  );
}
