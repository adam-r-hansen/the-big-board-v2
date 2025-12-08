'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useMediaQuery,
  useTheme,
  Tabs,
  Tab,
} from '@mui/material';
import { Check, Stars } from '@mui/icons-material';
import AppShell from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import GameCard from '@/components/picks/GameCard';
import TeamGrid from '@/components/picks/TeamGrid';
import WrinkleCard from '@/components/picks/WrinkleCard';

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

type Game = {
  id: string;
  week: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  game_utc: string;
  status: string;
  home: Team;
  away: Team;
};

type Pick = {
  id: string;
  week: number;
  team_id: string;
  game_id: string;
  points: number;
  locked_at: string | null;
};

type PickWithGame = Pick & {
  game_status: string;
};

type Wrinkle = {
  id: string;
  name: string;
  kind: string;
  week: number;
  spread: number | null;
  spread_team_id: string | null;
  config: any;
  game: Game;
};

type WrinklePick = {
  id: string;
  wrinkle_id: string;
  team_id: string;
  game_id: string;
  points: number;
  selection: any;
};

export default function PicksPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [games, setGames] = useState<Game[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<PickWithGame[]>([]);
  const [usedTeams, setUsedTeams] = useState<Set<string>>(new Set());
  const [activeLeagueSeasonId, setActiveLeagueSeasonId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState(0);

  // Wrinkles
  const [wrinkles, setWrinkles] = useState<Wrinkle[]>([]);
  const [wrinklePicks, setWrinklePicks] = useState<WrinklePick[]>([]);

  const supabase = createClient();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUserId(user.id);

      // Get active league from localStorage
      const leagueSeasonId = localStorage.getItem('activeLeagueSeasonId');
      if (!leagueSeasonId) {
        setError('No league selected');
        setLoading(false);
        return;
      }
      setActiveLeagueSeasonId(leagueSeasonId);

      // Load all teams
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, short_name, abbreviation, color_primary, color_secondary, logo, conference, division');
      
      if (teams) {
        setAllTeams(teams);
      }

      // Determine current week based on game dates
      const now = new Date();
      const { data: nextGame } = await supabase
        .from('games')
        .select('week')
        .eq('season', 2025)
        .gte('game_utc', now.toISOString())
        .order('game_utc', { ascending: true })
        .limit(1)
        .single();

      const week = nextGame?.week || 1;
      setSelectedWeek(week);

      // Load all user picks for the season with game status
      const { data: userPicks } = await supabase
        .from('picks_v2')
        .select(`
          *,
          game:games(status)
        `)
        .eq('league_season_id', leagueSeasonId)
        .eq('profile_id', user.id);

      if (userPicks) {
        const picksWithStatus = userPicks.map((p: any) => ({
          ...p,
          game_status: p.game?.status || 'UPCOMING',
        }));
        setPicks(picksWithStatus);
        setUsedTeams(new Set(picksWithStatus.map((p) => p.team_id)));
      }

      // Load wrinkle picks
      const { data: userWrinklePicks } = await supabase
        .from('wrinkle_picks_v2')
        .select('*')
        .eq('profile_id', user.id);

      if (userWrinklePicks) {
        setWrinklePicks(userWrinklePicks);
      }

      setLoading(false);
    };

    loadData();
  }, [supabase, router]);

  // Load games and wrinkles when week changes
  useEffect(() => {
    const loadGamesAndWrinkles = async () => {
      // Load games
      const { data: weekGames } = await supabase
        .from('games')
        .select(`
          id,
          week,
          home_team,
          away_team,
          home_score,
          away_score,
          game_utc,
          status,
          home:teams!games_home_team_fkey(id, name, short_name, abbreviation, color_primary, logo),
          away:teams!games_away_team_fkey(id, name, short_name, abbreviation, color_primary, logo)
        `)
        .eq('season', 2025)
        .eq('week', selectedWeek)
        .order('game_utc', { ascending: true });

      if (weekGames) {
        setGames(weekGames as unknown as Game[]);
      }

      // Load wrinkles for this week
      if (activeLeagueSeasonId) {
        const { data: weekWrinkles } = await supabase
          .from('wrinkles_v2')
          .select(`
            *,
            game:games(
              id,
              home_team,
              away_team,
              home_score,
              away_score,
              game_utc,
              status,
              home:teams!games_home_team_fkey(id, name, short_name, abbreviation, color_primary, logo),
              away:teams!games_away_team_fkey(id, name, short_name, abbreviation, color_primary, logo)
            )
          `)
          .eq('league_season_id', activeLeagueSeasonId)
          .eq('week', selectedWeek)
          .eq('status', 'active');

        if (weekWrinkles) {
          setWrinkles(weekWrinkles as unknown as Wrinkle[]);
        }
      }
    };

    if (!loading && activeLeagueSeasonId) {
      loadGamesAndWrinkles();
    }
  }, [selectedWeek, loading, supabase, activeLeagueSeasonId]);

  // Get picks for current week
  const weekPicks = picks.filter((p) => p.week === selectedWeek);
  const weekPickCount = weekPicks.length;

  // Build pickedTeams map for TeamGrid with game status
  const pickedTeams = new Map<string, { week: number; points: number; status: string }>();
  picks.forEach((p) => {
    pickedTeams.set(p.team_id, { 
      week: p.week, 
      points: p.points,
      status: p.game_status,
    });
  });

  // Check if a specific pick is locked
  const isPickLocked = (gameId: string) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return false;
    return new Date(game.game_utc) < new Date();
  };

  // Handle team selection for regular picks
  const handleSelectTeam = async (game: Game, teamId: string) => {
    if (!activeLeagueSeasonId || !userId || saving) return;

    const gameTime = new Date(game.game_utc);
    if (gameTime < new Date()) {
      setError('This game has already started');
      return;
    }

    setSaving(true);
    setError(null);

    const existingPick = weekPicks.find((p) => p.game_id === game.id);

    if (existingPick) {
      if (existingPick.locked_at) {
        setError('This pick is locked');
        setSaving(false);
        return;
      }

      if (existingPick.team_id === teamId) {
        await supabase.from('picks_v2').delete().eq('id', existingPick.id);
        setPicks(picks.filter((p) => p.id !== existingPick.id));
        setUsedTeams((prev) => {
          const next = new Set(prev);
          next.delete(teamId);
          return next;
        });
      } else {
        await supabase
          .from('picks_v2')
          .update({ team_id: teamId })
          .eq('id', existingPick.id);
        setPicks(
          picks.map((p) =>
            p.id === existingPick.id ? { ...p, team_id: teamId } : p
          )
        );
        setUsedTeams((prev) => {
          const next = new Set(prev);
          next.delete(existingPick.team_id);
          next.add(teamId);
          return next;
        });
      }
    } else {
      if (weekPickCount >= 2) {
        setError('You can only make 2 picks per week');
        setSaving(false);
        return;
      }

      if (usedTeams.has(teamId)) {
        setError('You have already used this team');
        setSaving(false);
        return;
      }

      const { data: newPick, error: insertError } = await supabase
        .from('picks_v2')
        .insert({
          league_season_id: activeLeagueSeasonId,
          profile_id: userId,
          week: selectedWeek,
          team_id: teamId,
          game_id: game.id,
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
      } else if (newPick) {
        setPicks([...picks, { ...newPick, game_status: 'UPCOMING' }]);
        setUsedTeams((prev) => new Set([...prev, teamId]));
      }
    }

    setSaving(false);
  };

  // Handle wrinkle pick
  const handleWrinklePick = async (wrinkle: Wrinkle, teamId: string) => {
    if (!userId || saving) return;

    const gameTime = new Date(wrinkle.game.game_utc);
    if (gameTime < new Date()) {
      setError('This wrinkle game has already started');
      return;
    }

    setSaving(true);
    setError(null);

    const existingPick = wrinklePicks.find((p) => p.wrinkle_id === wrinkle.id);

    if (existingPick) {
      if (existingPick.team_id === teamId) {
        // Remove pick
        await supabase.from('wrinkle_picks_v2').delete().eq('id', existingPick.id);
        setWrinklePicks(wrinklePicks.filter((p) => p.id !== existingPick.id));
      } else {
        // Change pick
        await supabase
          .from('wrinkle_picks_v2')
          .update({ team_id: teamId, game_id: wrinkle.game.id })
          .eq('id', existingPick.id);
        setWrinklePicks(
          wrinklePicks.map((p) =>
            p.id === existingPick.id ? { ...p, team_id: teamId, game_id: wrinkle.game.id } : p
          )
        );
      }
    } else {
      // New pick
      const { data: newPick, error: insertError } = await supabase
        .from('wrinkle_picks_v2')
        .insert({
          wrinkle_id: wrinkle.id,
          profile_id: userId,
          team_id: teamId,
          game_id: wrinkle.game.id,
          selection: { team_id: teamId },
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
      } else if (newPick) {
        setWrinklePicks([...wrinklePicks, newPick]);
      }
    }

    setSaving(false);
  };

  // Games Panel Content
  const GamesPanel = () => (
    <Box>
      {/* Week Selector */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Week</InputLabel>
        <Select
          value={selectedWeek}
          label="Week"
          onChange={(e) => setSelectedWeek(Number(e.target.value))}
        >
          {Array.from({ length: 18 }, (_, i) => (
            <MenuItem key={i + 1} value={i + 1}>
              Week {i + 1}
              {picks.filter((p) => p.week === i + 1).length >= 2 && ' ✓'}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Week Status */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">
            Week {selectedWeek}:
          </Typography>
          <Chip
            icon={weekPickCount >= 2 ? <Check /> : undefined}
            label={`${weekPickCount}/2 picks`}
            color={weekPickCount >= 2 ? 'success' : 'default'}
            size="small"
          />
          <Typography variant="caption" color="text.secondary">
            {32 - usedTeams.size} teams remaining
          </Typography>
        </Stack>
      </Paper>

      {/* Wrinkles */}
      {wrinkles.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Stars fontSize="small" />
            Wrinkles
          </Typography>
          <Stack spacing={2}>
            {wrinkles.map((wrinkle) => (
              <WrinkleCard
                key={wrinkle.id}
                wrinkle={wrinkle}
                pick={wrinklePicks.find((p) => p.wrinkle_id === wrinkle.id)}
                onSelectTeam={(teamId) => handleWrinklePick(wrinkle, teamId)}
                disabled={saving}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Games List */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Games
      </Typography>
      <Stack spacing={2}>
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            selectedTeamId={weekPicks.find((p) => p.game_id === game.id)?.team_id}
            usedTeams={usedTeams}
            onSelectTeam={(teamId) => handleSelectTeam(game, teamId)}
            disabled={saving || (weekPickCount >= 2 && !weekPicks.find((p) => p.game_id === game.id))}
            isLocked={isPickLocked(game.id)}
          />
        ))}
      </Stack>
    </Box>
  );

  // Team Grid Panel Content
  const TeamsPanel = () => (
    <TeamGrid teams={allTeams} pickedTeams={pickedTeams} />
  );

  if (loading) {
    return (
      <AppShell>
        <Container sx={{ py: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      </AppShell>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <AppShell>
        <Container maxWidth="sm" sx={{ py: 2, pb: 10 }}>
          <Typography variant="h5" gutterBottom>
            Make Your Picks
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {mobileTab === 0 ? <GamesPanel /> : <TeamsPanel />}

          {/* Bottom Tabs */}
          <Paper
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
            }}
            elevation={3}
          >
            <Tabs
              value={mobileTab}
              onChange={(_, v) => setMobileTab(v)}
              variant="fullWidth"
            >
              <Tab label="Pick" />
              <Tab label="My Teams" />
            </Tabs>
          </Paper>
        </Container>
      </AppShell>
    );
  }

  // Desktop Layout - 40/60 split
  return (
    <AppShell>
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }} 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Left Panel - 40% - Games */}
        <Box
          sx={{
            width: '40%',
            p: 3,
            overflow: 'auto',
            borderRight: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h5" gutterBottom>
            Make Your Picks
          </Typography>
          <GamesPanel />
        </Box>

        {/* Right Panel - 60% - Team Grid */}
        <Box
          sx={{
            width: '60%',
            p: 3,
            overflow: 'auto',
            bgcolor: 'background.default',
          }}
        >
          <Typography variant="h5" gutterBottom>
            Your Season
          </Typography>
          <TeamsPanel />
        </Box>
      </Box>
    </AppShell>
  );
}
