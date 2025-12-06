'use client';

import { useEffect, useState } from 'react';
import { Box, Paper, Typography, Stack, Chip, CircularProgress } from '@mui/material';
import { createClient } from '@/lib/supabase/client';

type Team = {
  short_name: string;
  abbreviation: string;
  logo: string;
};

type Game = {
  id: string;
  home_score: number | null;
  away_score: number | null;
  game_utc: string;
  status: string;
  home: Team;
  away: Team;
};

export default function NFLGames() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<Game[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);

  const supabase = createClient();

  useEffect(() => {
    const loadGames = async () => {
      // Get current week
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
      setCurrentWeek(week);

      // Get games for current week
      const { data: weekGames } = await supabase
        .from('games')
        .select(`
          id,
          home_score,
          away_score,
          game_utc,
          status,
          home:teams!games_home_team_fkey(short_name, abbreviation, logo),
          away:teams!games_away_team_fkey(short_name, abbreviation, logo)
        `)
        .eq('season', 2025)
        .eq('week', week)
        .order('game_utc', { ascending: true });

      if (weekGames) {
        setGames(weekGames as unknown as Game[]);
      }
      setLoading(false);
    };

    loadGames();
  }, [supabase]);

  if (loading) {
    return <CircularProgress size={24} />;
  }

  const GameRow = ({ game }: { game: Game }) => {
    const gameTime = new Date(game.game_utc);
    const isComplete = game.status === 'FINAL';
    const isLive = game.status === 'LIVE' || game.status === 'IN_PROGRESS';
    const hasStarted = gameTime < new Date();

    const homeWinning = (game.home_score ?? 0) > (game.away_score ?? 0);
    const awayWinning = (game.away_score ?? 0) > (game.home_score ?? 0);

    return (
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        {/* Time/Status Header */}
        <Typography 
          variant="caption" 
          color={isLive ? 'error.main' : 'text.secondary'}
          fontWeight={isLive ? 700 : 400}
          sx={{ display: 'block', mb: 1 }}
        >
          {isLive ? '🔴 LIVE' : isComplete ? 'FINAL' : gameTime.toLocaleString('en-US', { 
            weekday: 'short', 
            hour: 'numeric', 
            minute: '2-digit' 
          })}
        </Typography>

        {/* Away Team */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <Box
            component="img"
            src={game.away.logo}
            alt={game.away.short_name}
            sx={{ width: 24, height: 24, objectFit: 'contain' }}
          />
          <Typography 
            variant="body2" 
            fontWeight={awayWinning && hasStarted ? 700 : 400}
            sx={{ flexGrow: 1 }}
          >
            {game.away.short_name}
          </Typography>
          {hasStarted && (
            <Typography variant="body2" fontWeight={awayWinning ? 700 : 400}>
              {game.away_score ?? 0}
            </Typography>
          )}
        </Stack>

        {/* Home Team */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            component="img"
            src={game.home.logo}
            alt={game.home.short_name}
            sx={{ width: 24, height: 24, objectFit: 'contain' }}
          />
          <Typography 
            variant="body2" 
            fontWeight={homeWinning && hasStarted ? 700 : 400}
            sx={{ flexGrow: 1 }}
          >
            {game.home.short_name}
          </Typography>
          {hasStarted && (
            <Typography variant="body2" fontWeight={homeWinning ? 700 : 400}>
              {game.home_score ?? 0}
            </Typography>
          )}
        </Stack>
      </Paper>
    );
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Week {currentWeek}
        </Typography>
        <Chip label={`${games.length} games`} size="small" />
      </Stack>

      <Stack spacing={1}>
        {games.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
      </Stack>
    </Box>
  );
}
