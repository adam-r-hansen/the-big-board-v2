'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const verified = searchParams.get('verified') === 'true';

  const [leagueSeason, setLeagueSeason] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  // Redirect if not verified
  useEffect(() => {
    if (!verified) {
      router.push(`/join/${code}`);
    }
  }, [verified, code, router]);

  // Load league info
  useEffect(() => {
    const loadLeague = async () => {
      const { data, error } = await supabase
        .from('league_seasons_v2')
        .select(`
          id,
          season,
          league_id,
          leagues_v2 (
            name
          )
        `)
        .eq('join_code', code)
        .single();

      if (error || !data) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      setLeagueSeason(data);
      setLoading(false);
    };

    loadLeague();
  }, [code, supabase]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (tab === 0) {
      // Magic link registration
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/join/${code}/complete`,
          data: {
            display_name: displayName,
            joining_league_id: leagueSeason.league_id,
            joining_league_season_id: leagueSeason.id,
          },
        },
      });

      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }

      setSuccess('Check your email for the magic link!');
      setSubmitting(false);
    } else {
      // Password registration
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }

      if (data.user) {
        // Update profile with display name
        await supabase
          .from('profiles')
          .update({ display_name: displayName })
          .eq('id', data.user.id);

        // Create membership
        await supabase
          .from('league_memberships_v2')
          .insert({
            league_id: leagueSeason.league_id,
            profile_id: data.user.id,
            role: 'member',
          });

        // Create participant
        await supabase
          .from('league_season_participants_v2')
          .insert({
            league_season_id: leagueSeason.id,
            profile_id: data.user.id,
            active: true,
          });

        // Redirect to home
        router.push('/');
      }
    }
  };

  if (!verified || loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error && !leagueSeason) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Create Account
        </Typography>

        <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 1 }}>
          Joining
        </Typography>

        <Typography variant="h6" align="center" color="primary" sx={{ mb: 4 }}>
          {leagueSeason?.leagues_v2?.name}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ mb: 3 }}
        >
          <Tab label="Magic Link" />
          <Tab label="Password" />
        </Tabs>

        <Box component="form" onSubmit={handleRegister}>
          <TextField
            label="Display Name"
            fullWidth
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            sx={{ mb: 2 }}
            inputProps={{ maxLength: 50 }}
            helperText="This is how others will see you"
          />

          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
          />

          {tab === 1 && (
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Optional for magic link users"
            />
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={submitting || !email || !displayName || (tab === 1 && !password)}
            sx={{ mt: 2 }}
          >
            {submitting ? (
              <CircularProgress size={24} />
            ) : tab === 0 ? (
              'Send Magic Link'
            ) : (
              'Create Account'
            )}
          </Button>
        </Box>

        <Button
          variant="text"
          fullWidth
          onClick={() => router.push(`/join/${code}`)}
          sx={{ mt: 2 }}
        >
          ← Back
        </Button>
      </Paper>
    </Container>
  );
}
