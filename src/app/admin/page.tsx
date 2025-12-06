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
  List,
  ListItem,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import { Add, Stars, Group, Settings } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Create league form
  const [leagueName, setLeagueName] = useState('');
  const [season, setSeason] = useState(2025);
  const [joinCode, setJoinCode] = useState('');
  const [joinPasskey, setJoinPasskey] = useState('');

  // Existing leagues
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);

  // Auto-assign
  const [selectedLeague, setSelectedLeague] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);

  const supabase = createClient();

  // Generate random code
  const generateCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  useEffect(() => {
    setMounted(true);
    setJoinCode(generateCode());
    setJoinPasskey(generateCode());
    setSeason(new Date().getFullYear());
  }, []);

  // Load existing leagues
  useEffect(() => {
    const loadLeagues = async () => {
      const { data } = await supabase
        .from('league_seasons_v2')
        .select(`
          id,
          season,
          join_code,
          join_passkey,
          leagues_v2 (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      setLeagues(data || []);
      if (data && data.length > 0) {
        setSelectedLeague(data[0].id);
      }
      setLoadingLeagues(false);
    };

    loadLeagues();
  }, [supabase]);

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Create league
      const { data: league, error: leagueError } = await supabase
        .from('leagues_v2')
        .insert({ name: leagueName })
        .select()
        .single();

      if (leagueError) throw leagueError;

      // Create league season
      const { data: leagueSeason, error: seasonError } = await supabase
        .from('league_seasons_v2')
        .insert({
          league_id: league.id,
          season,
          join_code: joinCode,
          join_passkey: joinPasskey,
          playoffs_enabled: false,
        })
        .select()
        .single();

      if (seasonError) throw seasonError;

      // Add current user as admin
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('league_memberships_v2').insert({
          league_id: league.id,
          profile_id: user.id,
          role: 'admin',
        });

        await supabase.from('league_season_participants_v2').insert({
          league_season_id: leagueSeason.id,
          profile_id: user.id,
          active: true,
        });
      }

      setMessage({ type: 'success', text: `League created! Join URL: /join/${joinCode}` });
      
      // Refresh list
      setLeagues([{ ...leagueSeason, leagues_v2: league }, ...leagues]);
      
      // Reset form
      setLeagueName('');
      setJoinCode(generateCode());
      setJoinPasskey(generateCode());

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }

    setLoading(false);
  };

  const handleAutoAssign = async () => {
    if (!selectedLeague) return;
    
    setAutoAssignLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueSeasonId: selectedLeague,
          week: selectedWeek,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Auto-assign failed');
      }

      setMessage({ type: 'success', text: data.message });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }

    setAutoAssignLoading(false);
  };

  if (!mounted) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Quick Actions */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 4 }}>
        <Card>
          <CardContent>
            <Stars color="secondary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h6">Wrinkles</Typography>
            <Typography variant="body2" color="text.secondary">
              Create and manage bonus picks
            </Typography>
          </CardContent>
          <CardActions>
            <Button size="small" onClick={() => router.push('/admin/wrinkles')}>
              Manage Wrinkles
            </Button>
          </CardActions>
        </Card>

        <Card>
          <CardContent>
            <Group color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h6">Members</Typography>
            <Typography variant="body2" color="text.secondary">
              View and manage league members
            </Typography>
          </CardContent>
          <CardActions>
            <Button size="small" disabled>
              Coming Soon
            </Button>
          </CardActions>
        </Card>

        <Card>
          <CardContent>
            <Settings color="action" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h6">Settings</Typography>
            <Typography variant="body2" color="text.secondary">
              League settings and playoffs
            </Typography>
          </CardContent>
          <CardActions>
            <Button size="small" disabled>
              Coming Soon
            </Button>
          </CardActions>
        </Card>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Auto-Assign */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Auto-Assign Picks
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manually trigger auto-assign for users who missed picks.
          </Typography>

          <Stack spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>League</InputLabel>
              <Select
                value={selectedLeague}
                label="League"
                onChange={(e) => setSelectedLeague(e.target.value)}
              >
                {leagues.map((ls) => (
                  <MenuItem key={ls.id} value={ls.id}>
                    {ls.leagues_v2?.name} ({ls.season})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Week</InputLabel>
              <Select
                value={selectedWeek}
                label="Week"
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
              >
                {Array.from({ length: 18 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    Week {i + 1}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              color="warning"
              onClick={handleAutoAssign}
              disabled={autoAssignLoading || !selectedLeague}
            >
              {autoAssignLoading ? <CircularProgress size={24} /> : 'Run Auto-Assign'}
            </Button>
          </Stack>
        </Paper>

        {/* Create League */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Create New League
          </Typography>

          <Box component="form" onSubmit={handleCreateLeague}>
            <Stack spacing={2}>
              <TextField
                label="League Name"
                size="small"
                fullWidth
                required
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
              />

              <TextField
                label="Season Year"
                type="number"
                size="small"
                fullWidth
                required
                value={season}
                onChange={(e) => setSeason(Number(e.target.value))}
              />

              <TextField
                label="Join Code (URL)"
                size="small"
                fullWidth
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                helperText={`Join URL: /join/${joinCode}`}
              />

              <TextField
                label="Join Passkey"
                size="small"
                fullWidth
                required
                value={joinPasskey}
                onChange={(e) => setJoinPasskey(e.target.value)}
              />

              <Button
                type="submit"
                variant="contained"
                disabled={loading || !leagueName}
                startIcon={loading ? <CircularProgress size={20} /> : <Add />}
              >
                Create League
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Box>

      {/* Existing Leagues */}
      <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Existing Leagues
        </Typography>

        {loadingLeagues ? (
          <CircularProgress />
        ) : leagues.length === 0 ? (
          <Typography color="text.secondary">No leagues yet</Typography>
        ) : (
          <List>
            {leagues.map((ls) => (
              <ListItem key={ls.id} divider>
                <ListItemText
                  primary={ls.leagues_v2?.name}
                  secondary={
                    <>
                      Season: {ls.season} | 
                      Code: <strong>{ls.join_code}</strong> | 
                      Passkey: <strong>{ls.join_passkey}</strong>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
}
