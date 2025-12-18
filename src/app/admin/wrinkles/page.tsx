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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Autocomplete,
} from '@mui/material';
import { Delete, Add, ArrowBack } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';

type Team = {
  id: string;
  short_name: string;
  abbreviation: string;
};

type Game = {
  id: string;
  week: number;
  game_utc: string;
  home: Team;
  away: Team;
};

type Wrinkle = {
  id: string;
  week: number;
  name: string;
  kind: string;
  game_id: string | null;
  spread: number | null;
  spread_team_id: string | null;
  status: string;
  config: any;
  game?: Game;
};

const WRINKLE_TYPES = [
  { value: 'bonus_game', label: 'Bonus Game', description: 'Pick a team to win, earn their score as bonus points' },
  { value: 'bonus_game_ats', label: 'Bonus Game ATS', description: 'Pick a team against the spread' },
  { value: 'bonus_game_oof', label: 'Bonus Game OOF', description: 'Pick from teams with win % below .400' },
  { value: 'bonus_game_ou', label: 'Over/Under', description: 'Pick over or under on total points' },
  { value: 'winless_double', label: 'Winless Double', description: 'Double down on a winless team' },
];

export default function WrinklesAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // League selection
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('');

  // Form state
  const [week, setWeek] = useState(16);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('bonus_game');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [spread, setSpread] = useState<number | null>(null);
  const [spreadTeam, setSpreadTeam] = useState<string>('');
  const [overUnderTotal, setOverUnderTotal] = useState<number | null>(null);

  // Data
  const [games, setGames] = useState<Game[]>([]);
  const [wrinkles, setWrinkles] = useState<Wrinkle[]>([]);

  const supabase = createClient();

  // Load leagues
  useEffect(() => {
    const loadLeagues = async () => {
      const { data } = await supabase
        .from('league_seasons_v2')
        .select(`
          id,
          season,
          leagues_v2 (id, name)
        `)
        .order('created_at', { ascending: false });

      setLeagues(data || []);
      if (data && data.length > 0) {
        setSelectedLeague(data[0].id);
      }
      setLoading(false);
    };

    loadLeagues();
  }, [supabase]);

  // Load games when week changes
  useEffect(() => {
    const loadGames = async () => {
      const { data } = await supabase
        .from('games')
        .select(`
          id,
          week,
          game_utc,
          home:teams!games_home_team_fkey(id, short_name, abbreviation),
          away:teams!games_away_team_fkey(id, short_name, abbreviation)
        `)
        .eq('season', 2025)
        .eq('week', week)
        .order('game_utc', { ascending: true });

      setGames((data as unknown as Game[]) || []);
    };

    loadGames();
  }, [week, supabase]);

  // Load existing wrinkles
  useEffect(() => {
    const loadWrinkles = async () => {
      if (!selectedLeague) return;

      const { data } = await supabase
        .from('wrinkles_v2')
        .select(`
          *,
          game:games(
            id,
            week,
            game_utc,
            home:teams!games_home_team_fkey(id, short_name, abbreviation),
            away:teams!games_away_team_fkey(id, short_name, abbreviation)
          )
        `)
        .eq('league_season_id', selectedLeague)
        .order('week', { ascending: true });

      setWrinkles((data as unknown as Wrinkle[]) || []);
    };

    loadWrinkles();
  }, [selectedLeague, supabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeague || !selectedGame) return;

    setSaving(true);
    setMessage(null);

    // Build config based on wrinkle type
    const config: any = {};
    if (kind === 'bonus_game_ou' && overUnderTotal) {
      config.total = overUnderTotal;
    }

    const { data, error } = await supabase
      .from('wrinkles_v2')
      .insert({
        league_season_id: selectedLeague,
        week,
        name,
        kind,
        game_id: selectedGame.id,
        spread: kind === 'bonus_game_ats' ? spread : null,
        spread_team_id: kind === 'bonus_game_ats' ? spreadTeam : null,
        status: 'active',
        config,
      })
      .select(`
        *,
        game:games(
          id,
          week,
          game_utc,
          home:teams!games_home_team_fkey(id, short_name, abbreviation),
          away:teams!games_away_team_fkey(id, short_name, abbreviation)
        )
      `)
      .single();

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Wrinkle created!' });
      setWrinkles([...wrinkles, data as unknown as Wrinkle]);
      // Reset form
      setName('');
      setSelectedGame(null);
      setSpread(null);
      setSpreadTeam('');
      setOverUnderTotal(null);
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('wrinkles_v2')
      .delete()
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setWrinkles(wrinkles.filter(w => w.id !== id));
    }
  };

  const getGameLabel = (game: Game) => {
    const time = new Date(game.game_utc).toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${game.away.abbreviation} @ ${game.home.abbreviation} - ${time}`;
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

        <Typography variant="h4" gutterBottom>
          Wrinkles Admin
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {/* Create Wrinkle Form */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Create Wrinkle
            </Typography>

            <Stack spacing={2} component="form" onSubmit={handleCreate}>
              {/* League Selection */}
              <FormControl fullWidth size="small">
                <InputLabel>League</InputLabel>
                <Select
                  value={selectedLeague}
                  label="League"
                  onChange={(e) => setSelectedLeague(e.target.value)}
                >
                  {leagues.map((ls: any) => (
                    <MenuItem key={ls.id} value={ls.id}>
                      {ls.leagues_v2?.name} ({ls.season})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Week */}
              <TextField
                label="Week"
                type="number"
                size="small"
                fullWidth
                required
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                inputProps={{ min: 1, max: 18 }}
              />

              {/* Type */}
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={kind}
                  label="Type"
                  onChange={(e) => setKind(e.target.value)}
                >
                  {WRINKLE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="caption" color="text.secondary">
                {WRINKLE_TYPES.find(t => t.value === kind)?.description}
              </Typography>

              {/* Name */}
              <TextField
                label="Wrinkle Name"
                size="small"
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sunday Night Bonus"
              />

              {/* Game Selection */}
              <Autocomplete
                options={games}
                getOptionLabel={getGameLabel}
                value={selectedGame}
                onChange={(_, value) => setSelectedGame(value)}
                renderInput={(params) => (
                  <TextField {...params} label="Game" size="small" required />
                )}
              />

              {/* ATS: Spread */}
              {kind === 'bonus_game_ats' && selectedGame && (
                <>
                  <TextField
                    label="Spread"
                    type="number"
                    size="small"
                    fullWidth
                    value={spread ?? ''}
                    onChange={(e) => setSpread(Number(e.target.value))}
                    placeholder="-3.5"
                    inputProps={{ step: 0.5 }}
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel>Favorite</InputLabel>
                    <Select
                      value={spreadTeam}
                      label="Favorite"
                      onChange={(e) => setSpreadTeam(e.target.value)}
                    >
                      <MenuItem value={selectedGame.home.id}>
                        {selectedGame.home.short_name}
                      </MenuItem>
                      <MenuItem value={selectedGame.away.id}>
                        {selectedGame.away.short_name}
                      </MenuItem>
                    </Select>
                  </FormControl>
                </>
              )}

              {/* O/U: Total */}
              {kind === 'bonus_game_ou' && (
                <TextField
                  label="Total Points Line"
                  type="number"
                  size="small"
                  fullWidth
                  value={overUnderTotal ?? ''}
                  onChange={(e) => setOverUnderTotal(Number(e.target.value))}
                  placeholder="47.5"
                  inputProps={{ step: 0.5 }}
                />
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={saving || !selectedLeague || !selectedGame}
                startIcon={saving ? <CircularProgress size={20} /> : <Add />}
              >
                {saving ? 'Creating...' : 'Create Wrinkle'}
              </Button>
            </Stack>
          </Paper>

          {/* Existing Wrinkles */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Existing Wrinkles
            </Typography>

            <List>
              {wrinkles.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No wrinkles created yet
                </Typography>
              ) : (
                wrinkles.map((wrinkle) => (
                  <ListItem
                    key={wrinkle.id}
                    secondaryAction={
                      <IconButton edge="end" onClick={() => handleDelete(wrinkle.id)}>
                        <Delete />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={wrinkle.name}
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={`Week ${wrinkle.week}`} size="small" />
                          <Chip
                            label={WRINKLE_TYPES.find(t => t.value === wrinkle.kind)?.label || wrinkle.kind}
                            size="small"
                            color="primary"
                          />
                          {wrinkle.game && (
                            <Typography variant="caption">
                              {wrinkle.game.away.abbreviation} @ {wrinkle.game.home.abbreviation}
                            </Typography>
                          )}
                        </Stack>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        </Box>
      </Container>
    </AppShell>
  );
}
