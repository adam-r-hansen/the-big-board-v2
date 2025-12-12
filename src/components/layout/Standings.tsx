'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Paper, Typography, Stack, CircularProgress, Avatar, Chip, LinearProgress } from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

type Standing = {
  profile_id: string;
  display_name: string;
  profile_color: string;
  total_points: number;
  week_points: number;
  correct_picks: number;
  total_picks: number;
  teams_used: number;
};

export default function Standings() {
  const [loading, setLoading] = useState(true);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);

  const supabase = createClient();

  const loadStandings = useCallback(async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const leagueSeasonId = localStorage.getItem('activeLeagueSeasonId');
    if (!leagueSeasonId) {
      setLoading(false);
      return;
    }

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

    const week = nextGame?.week || 15;
    setCurrentWeek(week);

    // Get all participants for this league season
    const { data: participants, error: partError } = await supabase
      .from('league_season_participants_v2')
      .select(`
        profile_id,
        profiles (
          display_name,
          profile_color
        )
      `)
      .eq('league_season_id', leagueSeasonId)
      .eq('active', true);

    console.log('Participants query:', { leagueSeasonId, participants, partError });

    if (!participants || participants.length === 0) {
      console.log('No participants found for league:', leagueSeasonId);
      setLoading(false);
      return;
    }

    // Get all picks for this league season
    const { data: allPicks } = await supabase
      .from('picks_v2')
      .select(`
        profile_id,
        points,
        week,
        team_id,
        game:games(status)
      `)
      .eq('league_season_id', leagueSeasonId);

    console.log('Picks query:', { allPicks: allPicks?.length });

    // Calculate standings
    const standingsMap = new Map<string, Standing>();

    for (const p of participants) {
      const profile = p.profiles as any;
      standingsMap.set(p.profile_id, {
        profile_id: p.profile_id,
        display_name: profile?.display_name || 'Unknown',
        profile_color: profile?.profile_color || '#1976d2',
        total_points: 0,
        week_points: 0,
        correct_picks: 0,
        total_picks: 0,
        teams_used: 0,
      });
    }

    if (allPicks) {
      // Count unique teams used per user
      const teamsPerUser = new Map<string, Set<string>>();
      
      for (const pick of allPicks) {
        const standing = standingsMap.get(pick.profile_id);
        if (!standing) continue;

        // Track teams used
        if (!teamsPerUser.has(pick.profile_id)) {
          teamsPerUser.set(pick.profile_id, new Set());
        }
        teamsPerUser.get(pick.profile_id)!.add(pick.team_id);

        const game = pick.game as any;
        if (game?.status === 'FINAL') {
          standing.total_picks++;
          standing.total_points += pick.points || 0;
          if ((pick.points || 0) > 0) {
            standing.correct_picks++;
          }
          if (pick.week === week) {
            standing.week_points += pick.points || 0;
          }
        }
      }

      // Update teams_used count
      teamsPerUser.forEach((teams, odId) => {
        const standing = standingsMap.get(odId);
        if (standing) {
          standing.teams_used = teams.size;
        }
      });
    }

    // Sort by points descending
    const sorted = Array.from(standingsMap.values()).sort(
      (a, b) => b.total_points - a.total_points
    );

    console.log('Final standings:', sorted);
    setStandings(sorted);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStandings();

    // Listen for league changes
    const handleLeagueChange = () => {
      loadStandings();
    };

    window.addEventListener('leagueChanged', handleLeagueChange);
    return () => window.removeEventListener('leagueChanged', handleLeagueChange);
  }, [loadStandings]);

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  if (standings.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="body2" color="text.disabled" textAlign="center">
          No standings yet
        </Typography>
      </Paper>
    );
  }

  const maxPoints = Math.max(...standings.map(s => s.total_points), 1);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          Standings
        </Typography>
        <Chip label={`Week ${currentWeek}`} size="small" />
      </Stack>

      <Stack spacing={1.5}>
        {standings.map((standing, index) => {
          const isCurrentUser = standing.profile_id === currentUserId;
          const rank = index + 1;
          const progressPercent = (standing.total_points / maxPoints) * 100;

          return (
            <Box
              key={standing.profile_id}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: isCurrentUser ? 'primary.main' : 'background.default',
                color: isCurrentUser ? 'white' : 'inherit',
                border: 1,
                borderColor: isCurrentUser ? 'primary.main' : 'divider',
              }}
            >
              <Stack direction="row" alignItems="center" gap={2}>
                {/* Rank */}
                <Box sx={{ width: 32, textAlign: 'center' }}>
                  {rank === 1 ? (
                    <EmojiEvents sx={{ color: isCurrentUser ? 'white' : 'warning.main' }} />
                  ) : rank === 2 ? (
                    <Typography variant="h6" fontWeight={700} sx={{ color: isCurrentUser ? 'white' : 'grey.400' }}>
                      2
                    </Typography>
                  ) : rank === 3 ? (
                    <Typography variant="h6" fontWeight={700} sx={{ color: isCurrentUser ? 'white' : '#cd7f32' }}>
                      3
                    </Typography>
                  ) : (
                    <Typography variant="h6" fontWeight={700} color={isCurrentUser ? 'inherit' : 'text.secondary'}>
                      {rank}
                    </Typography>
                  )}
                </Box>

                {/* Avatar */}
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: isCurrentUser ? 'rgba(255,255,255,0.2)' : standing.profile_color,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {standing.display_name.charAt(0).toUpperCase()}
                </Avatar>

                {/* Name & Stats */}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body1" fontWeight={600} noWrap>
                    {standing.display_name}
                    {isCurrentUser && ' (You)'}
                  </Typography>
                  <Stack direction="row" gap={2} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {standing.correct_picks}-{standing.total_picks - standing.correct_picks} record
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {32 - standing.teams_used} teams left
                    </Typography>
                  </Stack>
                  {/* Progress bar */}
                  <LinearProgress 
                    variant="determinate" 
                    value={progressPercent} 
                    sx={{ 
                      mt: 1, 
                      height: 4, 
                      borderRadius: 2,
                      bgcolor: isCurrentUser ? 'rgba(255,255,255,0.2)' : 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: isCurrentUser ? 'white' : 'primary.main',
                      }
                    }} 
                  />
                </Box>

                {/* Points */}
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h5" fontWeight={700}>
                    {standing.total_points}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    {standing.week_points > 0 ? `+${standing.week_points} this week` : 'pts'}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
