'use client';

import { useEffect, useState } from 'react';
import { Box, Paper, Typography, Chip, Stack, CircularProgress, Button } from '@mui/material';
import { Check, Lock } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NFLGames from './NFLGames';
import Standings from './Standings';

type Pick = {
  id: string;
  week: number;
  team_id: string;
  game_id: string;
  points: number;
  locked_at: string | null;
  team: {
    short_name: string;
    abbreviation: string;
    color_primary: string;
    logo: string;
  };
  game: {
    status: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    game_utc: string;
  };
};

interface Props {
  children: React.ReactNode;
}

export default function DesktopLayout({ children }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weekPicks, setWeekPicks] = useState<Pick[]>([]);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [weekPoints, setWeekPoints] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const leagueSeasonId = localStorage.getItem('activeLeagueSeasonId');
      if (!leagueSeasonId) return;

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

      // Get all picks with team and game info
      const { data: allPicks } = await supabase
        .from('picks_v2')
        .select(`
          id,
          week,
          team_id,
          game_id,
          points,
          locked_at,
          team:teams(short_name, abbreviation, color_primary, logo),
          game:games(status, home_team, away_team, home_score, away_score, game_utc)
        `)
        .eq('league_season_id', leagueSeasonId)
        .eq('profile_id', user.id);

      if (allPicks) {
        const picks = allPicks as unknown as Pick[];
        setWeekPicks(picks.filter(p => p.week === week));
        setSeasonPoints(picks.reduce((sum, p) => sum + (p.points || 0), 0));
        setWeekPoints(picks.filter(p => p.week === week).reduce((sum, p) => sum + (p.points || 0), 0));
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const PickCard = ({ pick }: { pick: Pick }) => {
    const isLocked = !!pick.locked_at;
    const isComplete = pick.game.status === 'FINAL';
    const isHome = pick.team_id === pick.game.home_team;
    const teamScore = isHome ? pick.game.home_score : pick.game.away_score;
    const oppScore = isHome ? pick.game.away_score : pick.game.home_score;
    const isWinner = isComplete && teamScore !== null && oppScore !== null && teamScore > oppScore;
    const gameTime = new Date(pick.game.game_utc);

    return (
      <Paper
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          bgcolor: isComplete 
            ? isWinner ? 'success.main' : 'error.main'
            : pick.team.color_primary,
          color: '#fff',
        }}
      >
        <Box
          component="img"
          src={pick.team.logo}
          alt={pick.team.short_name}
          sx={{ width: 40, height: 40, objectFit: 'contain' }}
        />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body1" fontWeight={700}>
            {pick.team.short_name}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {isComplete 
              ? `Final: ${teamScore} - ${oppScore}` 
              : isLocked 
                ? 'In Progress'
                : gameTime.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
            }
          </Typography>
        </Box>
        {isComplete && (
          <Typography variant="h6" fontWeight={700}>
            {pick.points} pts
          </Typography>
        )}
        {isLocked && !isComplete && <Lock fontSize="small" sx={{ opacity: 0.7 }} />}
      </Paper>
    );
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '35% 35% 30%',
        gap: 2,
        p: 2,
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
      }}
    >
      {/* Column 1: Picks */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Picks
        </Typography>

        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <Box sx={{ flexGrow: 1 }}>
            {/* Week Summary */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" color="text.secondary">
                  Week {currentWeek}
                </Typography>
                <Chip 
                  icon={weekPicks.length >= 2 ? <Check /> : undefined}
                  label={`${weekPicks.length}/2 picks`}
                  size="small"
                  color={weekPicks.length >= 2 ? 'success' : 'default'}
                />
              </Stack>
            </Paper>

            {/* My Picks This Week */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              My Picks
            </Typography>
            {weekPicks.length === 0 ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>
                  No picks yet this week
                </Typography>
                <Button 
                  variant="contained" 
                  size="small"
                  onClick={() => router.push('/picks')}
                >
                  Make Picks
                </Button>
              </Box>
            ) : (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {weekPicks.map((pick) => (
                  <PickCard key={pick.id} pick={pick} />
                ))}
              </Stack>
            )}

            {/* TODO: League Picks (other users' locked picks) */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                League Picks (Locked)
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
                Coming soon
              </Typography>
            </Paper>
          </Box>
        )}
      </Paper>

      {/* Column 2: League */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          League
        </Typography>
        <Box sx={{ flexGrow: 1 }}>
          {/* Points Summary */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Season Total</Typography>
                <Typography variant="body1" fontWeight={700}>{seasonPoints} pts</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Week {currentWeek}</Typography>
                <Typography variant="body1" fontWeight={600}>{weekPoints} pts</Typography>
              </Stack>
            </Stack>
          </Paper>

          {/* Standings */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Standings
          </Typography>
          <Standings />
        </Box>
      </Paper>

      {/* Column 3: NFL Games */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          NFL Games
        </Typography>
        <Box sx={{ flexGrow: 1 }}>
          <NFLGames />
        </Box>
      </Paper>
    </Box>
  );
}
