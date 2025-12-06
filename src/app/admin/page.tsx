'use client';

import { useState, useEffect } from 'react';
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
} from '@mui/material';
import { createClient } from '@/lib/supabase/client';

// Generate random code
const generateCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function AdminPage() {
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

  const supabase = createClient();

  // Handle client-side mounting
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

  if (!mounted) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>

      {/* Create League */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Create New League
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Box component="form" onSubmit={handleCreateLeague}>
          <TextField
            label="League Name"
            fullWidth
            required
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Season Year"
            type="number"
            fullWidth
            required
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Join Code (URL)"
            fullWidth
            required
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            helperText={`Join URL: /join/${joinCode}`}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Join Passkey"
            fullWidth
            required
            value={joinPasskey}
            onChange={(e) => setJoinPasskey(e.target.value)}
            helperText="Users will enter this to verify access"
            sx={{ mb: 2 }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={loading || !leagueName}
          >
            {loading ? <CircularProgress size={24} /> : 'Create League'}
          </Button>
        </Box>
      </Paper>

      {/* Existing Leagues */}
      <Paper elevation={2} sx={{ p: 3 }}>
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
