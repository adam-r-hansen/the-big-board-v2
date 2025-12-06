'use client';

import { useState, useEffect } from 'react';
import { Box, Paper, Tabs, Tab, Typography, Stack, Chip, CircularProgress } from '@mui/material';
import { SportsFootball, Leaderboard, EmojiEvents, Check, Lock } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}
    >
      {value === index && children}
    </Box>
  );
}

interface Props {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: Props) {
  const [tab, setTab] = useState(0);
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Tabs at top */}
      <Paper elevation={1} sx={{ borderRadius: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 48 }}
        >
          <Tab icon={<SportsFootball />} label="Picks" sx={{ minHeight: 48 }} />
          <Tab icon={<Leaderboard />} label="League" sx={{ minHeight: 48 }} />
          <Tab icon={<EmojiEvents />} label="NFL Games" sx={{ minHeight: 48 }} />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={tab} index={0}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Picks
        </Typography>

        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
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
        
            {/* My Picks */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              My Picks
            </Typography>
            {weekPicks.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                No picks yet this week
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {weekPicks.map((pick) => (
                  <PickCard key={pick.id} pick={pick} />
                ))}
              </Stack>
            )}

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                League Picks (Locked)
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
                Coming soon
              </Typography>
            </Paper>
          </>
        )}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          League
        </Typography>

        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
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

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Standings
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
                Coming soon
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Quick Stats
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
                Coming soon
              </Typography>
            </Paper>
          </>
        )}
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          NFL Games
        </Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            This Week&apos;s Games
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
            Coming soon
          </Typography>
        </Paper>
      </TabPanel>
    </Box>
  );
}
