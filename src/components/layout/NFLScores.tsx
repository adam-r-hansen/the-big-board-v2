'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Stack, Chip, useTheme, useMediaQuery } from '@mui/material';
import { Circle } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

type GameStatus = 'LIVE' | 'UPCOMING' | 'FINAL';

type Game = {
  id: string;
  week: number;
  season: number;
  game_utc: string;
  status: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  home_team_data: {
    abbreviation: string;
    short_name: string;
    logo: string;
    color_primary: string;
    wins: number;
    losses: number;
    ties: number;
  };
  away_team_data: {
    abbreviation: string;
    short_name: string;
    logo: string;
    color_primary: string;
    wins: number;
    losses: number;
    ties: number;
  };
};

const statusOrder: Record<GameStatus, number> = {
  LIVE: 0,
  UPCOMING: 1,
  FINAL: 2,
};

function toGameStatus(status: string): GameStatus | null {
  if (status === 'LIVE' || status === 'UPCOMING' || status === 'FINAL') return status;
  return null;
}

export default function NFLScores() {
  const [games, setGames] = useState<Game[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const supabase = createClient();

  useEffect(() => {
    loadGames();
    const interval = setInterval(loadGames, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGames = async () => {
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

    const { data } = await supabase
      .from('games')
      .select(
        `
        id,
        week,
        season,
        game_utc,
        status,
        home_team,
        away_team,
        home_score,
        away_score,
        home_team_data:teams!games_home_team_fkey(abbreviation, short_name, logo, color_primary, wins, losses, ties),
        away_team_data:teams!games_away_team_fkey(abbreviation, short_name, logo, color_primary, wins, losses, ties)
      `
      )
      .eq('season', 2025)
      .eq('week', week)
      .order('game_utc', { ascending: true });

    if (data) {
      // Sort: LIVE first, then UPCOMING, then FINAL (unknown statuses go last)
      const sortedGames = (data as unknown as Game[]).sort((a, b) => {
        const aKey = toGameStatus(a.status);
        const bKey = toGameStatus(b.status);

        const aOrder = aKey ? statusOrder[aKey] : 99;
        const bOrder = bKey ? statusOrder[bKey] : 99;

        return aOrder - bOrder;
      });

      setGames(sortedGames);
    }

    setLoading(false);
  };

  const formatRecord = (wins: number, losses: number, ties: number) => {
    if (ties > 0) return `${wins}-${losses}-${ties}`;
    return `${wins}-${losses}`;
  };

  const liveGames = games.filter((g) => g.status === 'LIVE');

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          NFL Scores
        </Typography>
        <Chip label={`Week ${currentWeek}`} size="small" color="primary" />
      </Stack>

      {liveGames.length > 0 && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
          <Circle sx={{ fontSize: 12, color: 'error.main' }} />
          <Typography variant="caption" fontWeight={600} color="error.main">
            LIVE
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {liveGames.length}
          </Typography>
        </Stack>
      )}

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      ) : (
        <Stack spacing={2}>
          {games.map((game) => {
            const isLive = game.status === 'LIVE';
            const isFinal = game.status === 'FINAL';
            const gameTime = new Date(game.game_utc);

            return (
              <Box
                key={game.id}
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                {/* Away Team */}
                <Box
                  sx={{
                    bgcolor: game.away_team_data.color_primary,
                    color: 'white',
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      component="img"
                      src={game.away_team_data.logo}
                      alt={game.away_team_data.abbreviation}
                      sx={{ width: 32, height: 32, objectFit: 'contain' }}
                    />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1" fontWeight={700}>
                      {isMobile ? game.away_team_data.abbreviation : game.away_team_data.short_name}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      {formatRecord(
                        game.away_team_data.wins,
                        game.away_team_data.losses,
                        game.away_team_data.ties
                      )}
                    </Typography>
                  </Box>
                  {(isLive || isFinal) && game.away_score !== null && (
                    <Typography variant="h4" fontWeight={700}>
                      {game.away_score}
                    </Typography>
                  )}
                </Box>

                {/* Home Team */}
                <Box
                  sx={{
                    bgcolor: game.home_team_data.color_primary,
                    color: 'white',
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      component="img"
                      src={game.home_team_data.logo}
                      alt={game.home_team_data.abbreviation}
                      sx={{ width: 32, height: 32, objectFit: 'contain' }}
                    />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1" fontWeight={700}>
                      {isMobile ? game.home_team_data.abbreviation : game.home_team_data.short_name}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      {formatRecord(
                        game.home_team_data.wins,
                        game.home_team_data.losses,
                        game.home_team_data.ties
                      )}
                    </Typography>
                  </Box>
                  {(isLive || isFinal) && game.home_score !== null && (
                    <Typography variant="h4" fontWeight={700}>
                      {game.home_score}
                    </Typography>
                  )}
                </Box>

                {/* Game Status */}
                <Box sx={{ bgcolor: 'background.paper', p: 1, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    {isFinal
                      ? 'FINAL'
                      : isLive
                      ? 'LIVE'
                      : gameTime.toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
