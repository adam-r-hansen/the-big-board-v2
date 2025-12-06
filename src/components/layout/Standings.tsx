'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Stack, CircularProgress, Avatar } from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

type Standing = {
  profile_id: string;
  display_name: string;
  profile_color: string;
  total_points: number;
  correct_picks: number;
  total_picks: number;
};

export default function Standings() {
  const [loading, setLoading] = useState(true);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const loadStandings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const leagueSeasonId = localStorage.getItem('activeLeagueSeasonId');
      if (!leagueSeasonId) return;

      // Get all participants for this league season
      const { data: participants } = await supabase
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

      if (!participants) return;

      // Get all picks for this league season
      const { data: allPicks } = await supabase
        .from('picks_v2')
        .select(`
          profile_id,
          points,
          game:games(status, home_team, away_team, home_score, away_score)
        `)
        .eq('league_season_id', leagueSeasonId);

      // Calculate standings
      const standingsMap = new Map<string, Standing>();

      for (const p of participants) {
        const profile = p.profiles as any;
        standingsMap.set(p.profile_id, {
          profile_id: p.profile_id,
          display_name: profile?.display_name || 'Unknown',
          profile_color: profile?.profile_color || '#1976d2',
          total_points: 0,
          correct_picks: 0,
          total_picks: 0,
        });
      }

      if (allPicks) {
        for (const pick of allPicks) {
          const standing = standingsMap.get(pick.profile_id);
          if (!standing) continue;

          const game = pick.game as any;
          if (game?.status === 'FINAL') {
            standing.total_picks++;
            standing.total_points += pick.points || 0;
            if ((pick.points || 0) > 0) {
              standing.correct_picks++;
            }
          }
        }
      }

      // Sort by points descending
      const sorted = Array.from(standingsMap.values()).sort(
        (a, b) => b.total_points - a.total_points
      );

      setStandings(sorted);
      setLoading(false);
    };

    loadStandings();
  }, [supabase]);

  if (loading) {
    return <CircularProgress size={24} />;
  }

  if (standings.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        No standings yet
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {standings.map((standing, index) => {
        const isCurrentUser = standing.profile_id === currentUserId;
        const rank = index + 1;

        return (
          <Box
            key={standing.profile_id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: 1,
              bgcolor: isCurrentUser ? 'action.selected' : 'transparent',
              border: isCurrentUser ? 1 : 0,
              borderColor: 'primary.main',
            }}
          >
            {/* Rank */}
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{
                width: 24,
                textAlign: 'center',
                color: rank <= 3 ? 'warning.main' : 'text.secondary',
              }}
            >
              {rank === 1 ? <EmojiEvents fontSize="small" color="warning" /> : rank}
            </Typography>

            {/* Avatar */}
            <Avatar
              sx={{
                width: 28,
                height: 28,
                bgcolor: standing.profile_color,
                fontSize: 12,
              }}
            >
              {standing.display_name.charAt(0).toUpperCase()}
            </Avatar>

            {/* Name */}
            <Typography
              variant="body2"
              fontWeight={isCurrentUser ? 700 : 400}
              sx={{ flexGrow: 1 }}
            >
              {standing.display_name}
              {isCurrentUser && ' (You)'}
            </Typography>

            {/* Record */}
            <Typography variant="caption" color="text.secondary">
              {standing.correct_picks}-{standing.total_picks - standing.correct_picks}
            </Typography>

            {/* Points */}
            <Typography variant="body2" fontWeight={700}>
              {standing.total_points}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
