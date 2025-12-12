'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Stack, CircularProgress, Chip } from '@mui/material';
import { Circle } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

type Team = {
  short_name: string;
  abbreviation: string;
  logo: string;
  color_primary: string;
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

export default function NFLScores() {
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
          home:teams!games_home_team_fkey(short_name, abbreviation, logo, color_primary),
          away:teams!games_away_team_fkey(short_name, abbreviation, logo, color_primary)
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

    // Refresh every 60 seconds for live scores
    const interval = setInterval(loadGames, 60000);
    return () => clearInterval(interval);
  }, [supabase]);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Group games by status
  const now = new Date();
  const liveGames = games.filter(g => g.status === 'LIVE' || g.status === 'IN_PROGRESS');
  const finalGames = games.filter(g => g.status === 'FINAL');
  const upcomingGames = games.filter(g => 
    g.status !== 'FINAL' && g.status !== 'LIVE' && g.status !== 'IN_PROGRESS'
  );

  const GameRow = ({ game }: { game: Game }) => {
    const gameTime = new Date(game.game_utc);
    const isComplete = game.status === 'FINAL';
    const isLive = game.status === 'LIVE' || game.status === 'IN_PROGRESS';
    const hasStarted = isComplete || isLive;

    const homeWinning = (game.home_score ?? 0) > (game.away_score ?? 0);
    const awayWinning = (game.away_score ?? 0) > (game.home_score ?? 0);

    return (
      <Box
        sx={{
          py: 1,
          px: 1.5,
          borderRadius: 1,
          bgcolor: isLive ? 'error.main' : 'background.paper',
          color: isLive ? 'white' : 'inherit',
          border: 1,
          borderColor: isLive ? 'error.main' : 'divider',
        }}
      >
        {/* Away Team */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <Box
            component="img"
            src={game.away.logo}
            alt={game.away.abbreviation}
            sx={{ width: 20, height: 20, objectFit: 'contain' }}
          />
          <Typography 
            variant="body2" 
            fontWeight={awayWinning && hasStarted ? 700 : 400}
            sx={{ flexGrow: 1 }}
            noWrap
          >
            {game.away.abbreviation}
          </Typography>
          {hasStarted && (
            <Typography 
              variant="body2" 
              fontWeight={awayWinning ? 700 : 400}
              sx={{ minWidth: 24, textAlign: 'right' }}
            >
              {game.away_score ?? 0}
            </Typography>
          )}
        </Stack>

        {/* Home Team */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            component="img"
            src={game.home.logo}
            alt={game.home.abbreviation}
            sx={{ width: 20, height: 20, objectFit: 'contain' }}
          />
          <Typography 
            variant="body2" 
            fontWeight={homeWinning && hasStarted ? 700 : 400}
            sx={{ flexGrow: 1 }}
            noWrap
          >
            {game.home.abbreviation}
          </Typography>
          {hasStarted && (
            <Typography 
              variant="body2" 
              fontWeight={homeWinning ? 700 : 400}
              sx={{ minWidth: 24, textAlign: 'right' }}
            >
              {game.home_score ?? 0}
            </Typography>
          )}
        </Stack>

        {/* Time for upcoming games */}
        {!hasStarted && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
            {gameTime.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
          </Typography>
        )}
      </Box>
    );
  };

  const GameSection = ({ title, games, icon }: { title: string; games: Game[]; icon?: React.ReactNode }) => {
    if (games.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
          {icon}
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            {title}
          </Typography>
          <Chip label={games.length} size="small" sx={{ height: 18, fontSize: 11 }} />
        </Stack>
        <Stack spacing={0.75}>
          {games.map((game) => (
            <GameRow key={game.id} game={game} />
          ))}
        </Stack>
      </Box>
    );
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          NFL Scores
        </Typography>
        <Chip label={`Week ${currentWeek}`} size="small" color="primary" />
      </Stack>

      <GameSection 
        title="LIVE" 
        games={liveGames} 
        icon={<Circle sx={{ fontSize: 8, color: 'error.main', animation: 'pulse 1.5s infinite' }} />}
      />
      <GameSection title="UPCOMING" games={upcomingGames} />
      <GameSection title="FINAL" games={finalGames} />

      {games.length === 0 && (
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
          No games this week
        </Typography>
      )}
    </Box>
  );
}
