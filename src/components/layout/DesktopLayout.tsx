'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Stack, Chip, CircularProgress, Button } from '@mui/material';
import { Check, Lock, Stars } from '@mui/icons-material';
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

type WrinklePick = {
  id: string;
  wrinkle_id: string;
  team_id: string;
  points: number;
  wrinkle: {
    name: string;
    kind: string;
    week: number;
    league_season_id: string;
    game: {
      status: string;
      home_team: string;
      away_team: string;
      home_score: number | null;
      away_score: number | null;
    };
  };
  team: {
    short_name: string;
    abbreviation: string;
    color_primary: string;
    logo: string;
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
  const [wrinklePicks, setWrinklePicks] = useState<WrinklePick[]>([]);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [weekPoints, setWeekPoints] = useState(0);
  const [leagueSeasonId, setLeagueSeasonId] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async (leagueId: string) => {
    console.log('Loading data for league:', leagueId);
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
      .eq('league_season_id', leagueId)
      .eq('profile_id', user.id);

    let seasonTotal = 0;
    let weekTotal = 0;

    if (allPicks) {
      const picks = allPicks as unknown as Pick[];
      setWeekPicks(picks.filter(p => p.week === week));
      seasonTotal = picks.reduce((sum, p) => sum + (p.points || 0), 0);
      weekTotal = picks.filter(p => p.week === week).reduce((sum, p) => sum + (p.points || 0), 0);
    } else {
      setWeekPicks([]);
    }

    // Get wrinkle picks
    const { data: allWrinklePicks } = await supabase
      .from('wrinkle_picks_v2')
      .select(`
        id,
        wrinkle_id,
        team_id,
        points,
        wrinkle:wrinkles_v2(
          name,
          kind,
          week,
          league_season_id,
          game:games(status, home_team, away_team, home_score, away_score)
        ),
        team:teams(short_name, abbreviation, color_primary, logo)
      `)
      .eq('profile_id', user.id);

    if (allWrinklePicks) {
      const wPicks = allWrinklePicks as unknown as WrinklePick[];
      const filteredWrinklePicks = wPicks.filter(
        p => p.wrinkle?.league_season_id === leagueId && p.wrinkle?.week === week
      );
      setWrinklePicks(filteredWrinklePicks);
      
      const leagueWrinklePicks = wPicks.filter(p => p.wrinkle?.league_season_id === leagueId);
      seasonTotal += leagueWrinklePicks.reduce((sum, p) => sum + (p.points || 0), 0);
      weekTotal += filteredWrinklePicks.reduce((sum, p) => sum + (p.points || 0), 0);
    } else {
      setWrinklePicks([]);
    }

    setSeasonPoints(seasonTotal);
    setWeekPoints(weekTotal);
    setLoading(false);
  }, [supabase]);

  // Initial load
  useEffect(() => {
    const storedLeagueId = localStorage.getItem('activeLeagueSeasonId');
    if (storedLeagueId) {
      setLeagueSeasonId(storedLeagueId);
      loadData(storedLeagueId);
    }
  }, [loadData]);

  // Listen for league changes
  useEffect(() => {
    const handleLeagueChange = (event: CustomEvent) => {
      console.log('League changed event received:', event.detail);
      const newLeagueId = event.detail;
      setLeagueSeasonId(newLeagueId);
      loadData(newLeagueId);
    };

    window.addEventListener('leagueChanged', handleLeagueChange as EventListener);
    return () => window.removeEventListener('leagueChanged', handleLeagueChange as EventListener);
  }, [loadData]);

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
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          border: 2,
          borderColor: pick.team.color_primary,
          borderLeftWidth: 4,
          borderLeftColor: isComplete ? (isWinner ? 'success.main' : 'error.main') : 'transparent',
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'white',
            border: 2,
            borderColor: pick.team.color_primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={pick.team.logo}
            alt={pick.team.short_name}
            sx={{ width: 28, height: 28, objectFit: 'contain' }}
          />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            {pick.team.short_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isComplete 
              ? `Final: ${teamScore} - ${oppScore}` 
              : isLocked 
                ? 'In Progress'
                : gameTime.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
            }
          </Typography>
        </Box>
        {isComplete && (
          <Typography variant="body1" fontWeight={700} color={isWinner ? 'success.main' : 'error.main'}>
            {pick.points} pts
          </Typography>
        )}
        {isLocked && !isComplete && <Lock fontSize="small" color="disabled" />}
      </Paper>
    );
  };

  const WrinklePickCard = ({ pick }: { pick: WrinklePick }) => {
    const isComplete = pick.wrinkle.game.status === 'FINAL';
    const isHome = pick.team_id === pick.wrinkle.game.home_team;
    const teamScore = isHome ? pick.wrinkle.game.home_score : pick.wrinkle.game.away_score;
    const oppScore = isHome ? pick.wrinkle.game.away_score : pick.wrinkle.game.home_score;
    const isWinner = isComplete && teamScore !== null && oppScore !== null && teamScore > oppScore;

    return (
      <Paper
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          border: 2,
          borderColor: 'secondary.main',
          borderLeftWidth: 4,
          borderLeftColor: isComplete ? (isWinner ? 'success.main' : 'error.main') : 'transparent',
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'white',
            border: 2,
            borderColor: pick.team.color_primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={pick.team.logo}
            alt={pick.team.short_name}
            sx={{ width: 28, height: 28, objectFit: 'contain' }}
          />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="caption" color="secondary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Stars sx={{ fontSize: 12 }} />
            {pick.wrinkle.name}
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {pick.team.short_name}
          </Typography>
        </Box>
        {isComplete && (
          <Typography variant="body1" fontWeight={700} color={isWinner ? 'success.main' : 'error.main'}>
            +{pick.points} pts
          </Typography>
        )}
      </Paper>
    );
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left Column - My Picks */}
      <Box sx={{ width: 300, p: 2, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          Week {currentWeek}
        </Typography>

        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Picks
                </Typography>
                <Chip 
                  icon={weekPicks.length >= 2 ? <Check /> : undefined}
                  label={`${weekPicks.length}/2`}
                  size="small"
                  color={weekPicks.length >= 2 ? 'success' : 'default'}
                />
              </Stack>
            </Paper>

            {weekPicks.length === 0 && wrinklePicks.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>
                  No picks yet
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
              <Stack spacing={1.5}>
                {weekPicks.map((pick) => (
                  <PickCard key={pick.id} pick={pick} />
                ))}
                {wrinklePicks.map((pick) => (
                  <WrinklePickCard key={pick.id} pick={pick} />
                ))}
              </Stack>
            )}

            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Week Points</Typography>
                  <Typography variant="body1" fontWeight={600}>{weekPoints}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Season Total</Typography>
                  <Typography variant="body1" fontWeight={700}>{seasonPoints}</Typography>
                </Stack>
              </Stack>
            </Paper>
          </>
        )}
      </Box>

      {/* Center - Main Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        {children}
      </Box>

      {/* Right Column - NFL Scores & Standings */}
      <Box sx={{ width: 320, p: 2, borderLeft: 1, borderColor: 'divider', overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          NFL Scores
        </Typography>
        <NFLGames />

        <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
          Standings
        </Typography>
        <Standings />
      </Box>
    </Box>
  );
}
