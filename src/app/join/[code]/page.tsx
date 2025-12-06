'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { createClient } from '@/lib/supabase/client';

type LeagueSeason = {
  id: string;
  season: number;
  league_id: string;
  leagues_v2: {
    name: string;
  };
};

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [leagueSeason, setLeagueSeason] = useState<LeagueSeason | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Passkey
  const [passkey, setPasskey] = useState('');
  const [passkeyVerified, setPasskeyVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Step 2: Auth state
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const supabase = createClient();

  // Load league season by join code
  useEffect(() => {
    const loadLeague = async () => {
      const { data, error } = await supabase
        .from('league_seasons_v2')
        .select(`
          id,
          season,
          league_id,
          join_passkey,
          leagues_v2 (
            name
          )
        `)
        .eq('join_code', code)
        .single();

      if (error || !data) {
        setError('Invalid or expired invite link');
        setLoading(false);
        return;
      }

      setLeagueSeason(data as unknown as LeagueSeason);
      setLoading(false);
    };

    loadLeague();
  }, [code, supabase]);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setCheckingAuth(false);
    };
    checkAuth();
  }, [supabase.auth]);

  // Verify passkey
  const handleVerifyPasskey = async () => {
    setVerifying(true);
    setError(null);

    const { data, error } = await supabase
      .from('league_seasons_v2')
      .select('id')
      .eq('join_code', code)
      .eq('join_passkey', passkey)
      .single();

    if (error || !data) {
      setError('Incorrect passkey');
      setVerifying(false);
      return;
    }

    setPasskeyVerified(true);
    setVerifying(false);
  };

  // Join league (for logged in users)
  const handleJoinLeague = async () => {
    if (!user || !leagueSeason) return;

    setVerifying(true);
    setError(null);

    // Check if already a member
    const { data: existingMembership } = await supabase
      .from('league_memberships_v2')
      .select('id')
      .eq('league_id', leagueSeason.league_id)
      .eq('profile_id', user.id)
      .single();

    if (!existingMembership) {
      // Create membership
      const { error: membershipError } = await supabase
        .from('league_memberships_v2')
        .insert({
          league_id: leagueSeason.league_id,
          profile_id: user.id,
          role: 'member',
        });

      if (membershipError) {
        setError('Failed to join league');
        setVerifying(false);
        return;
      }
    }

    // Check if already a participant this season
    const { data: existingParticipant } = await supabase
      .from('league_season_participants_v2')
      .select('id')
      .eq('league_season_id', leagueSeason.id)
      .eq('profile_id', user.id)
      .single();

    if (!existingParticipant) {
      // Create participant record
      const { error: participantError } = await supabase
        .from('league_season_participants_v2')
        .insert({
          league_season_id: leagueSeason.id,
          profile_id: user.id,
          active: true,
        });

      if (participantError) {
        setError('Failed to join season');
        setVerifying(false);
        return;
      }
    }

    // Success - redirect to home
    router.push('/');
  };

  if (loading) {
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
          Join League
        </Typography>

        <Typography variant="h6" align="center" color="primary" sx={{ mb: 1 }}>
          {leagueSeason?.leagues_v2?.name}
        </Typography>

        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 4 }}>
          {leagueSeason?.season} Season
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Step 1: Passkey Verification */}
        {!passkeyVerified ? (
          <Box component="form" onSubmit={(e) => { e.preventDefault(); handleVerifyPasskey(); }}>
            <TextField
              label="Enter Passkey"
              fullWidth
              required
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              sx={{ mb: 3 }}
              autoFocus
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={verifying || !passkey}
            >
              {verifying ? <CircularProgress size={24} /> : 'Verify'}
            </Button>
          </Box>
        ) : (
          /* Step 2: Join or Register */
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              Passkey verified!
            </Alert>

            {checkingAuth ? (
              <Box sx={{ textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            ) : user ? (
              /* Logged in - just join */
              <Box>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Logged in as <strong>{user.email}</strong>
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleJoinLeague}
                  disabled={verifying}
                >
                  {verifying ? <CircularProgress size={24} /> : 'Join League'}
                </Button>

                <Divider sx={{ my: 3 }}>or</Divider>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                  }}
                >
                  Use Different Account
                </Button>
              </Box>
            ) : (
              /* Not logged in - show register/login options */
              <Box>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={() => router.push(`/join/${code}/register?verified=true`)}
                  sx={{ mb: 2 }}
                >
                  Create Account
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  size="large"
                  onClick={() => router.push(`/auth/login?redirect=/join/${code}&verified=true`)}
                >
                  Already have an account? Sign In
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Container>
  );
}
