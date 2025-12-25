'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Stack, Chip, CircularProgress, Button, Divider } from '@mui/material';
import { Check, Lock, Stars, Group } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NFLScores from './NFLScores';
import Reactions from '@/components/Reactions';
import WeekPicker from '@/components/WeekPicker';

type Team = {
  short_name: string;
  abbreviation: string;
  color_primary: string;
  logo: string;
};

type Game = {
  status: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  game_utc: string;
};

type Pick = {
  id: string;
  week: number;
  team_id: string;
  game_id: string;
  points: number;
  multiplier: number;
  locked_at: string | null;
  profile_id: string;
  auto_assigned?: boolean;
  team: Team;
  game: Game;
  profile?: {
    display_name: string;
    profile_color: string;
  };
};

type PlayoffPick = {
  id: string;
  profile_id: string;
  team_id: string;
  pick_position: number;
  game_id: string;
  points: number;
  team: Team;
  game: Game;
  profile?: {
    display_name: string;
    profile_color: string;
  };
};

type WrinklePick = {
  id: string;
  wrinkle_id: string;
  team_id: string;
  points: number;
  profile_id: string;
  wrinkle: {
    name: string;
    kind: string;
    week: number;
    league_season_id: string;
    game: Game | null;
  };
  team: Team;
  profile?: {
    display_name: string;
    profile_color: string;
  };
  oofGameTime?: string;
};

interface Props {
  children: React.ReactNode;
}

export default function DesktopLayout({ children }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [viewingWeek, setViewingWeek] = useState(1);
  const [weekPicks, setWeekPicks] = useState<Pick[]>([]);
  const [leaguePicks, setLeaguePicks] = useState<Pick[]>([]);
  const [leagueWrinklePicks, setLeagueWrinklePicks] = useState<WrinklePick[]>([]);
  const [wrinklePicks, setWrinklePicks] = useState<WrinklePick[]>([]);
  const [playoffPicks, setPlayoffPicks] = useState<PlayoffPick[]>([]);
  const [leaguePlayoffPicks, setLeaguePlayoffPicks] = useState<PlayoffPick[]>([]);
  const [isPlayoffs, setIsPlayoffs] = useState(false);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [weekPoints, setWeekPoints] = useState(0);
  const [leagueSeasonId, setLeagueSeasonId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [anyGamesLocked, setAnyGamesLocked] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async (leagueId: string, week?: number) => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

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

    const actualCurrentWeek = nextGame?.week || 17;
    setCurrentWeek(actualCurrentWeek);
    
    const weekToLoad = week !== undefined ? week : actualCurrentWeek;
    setViewingWeek(weekToLoad);

    // Check if playoffs are enabled
    const { data: leagueSeason } = await supabase
      .from('league_seasons_v2')
      .select('playoffs_enabled')
      .eq('id', leagueId)
      .single();

    const playoffsEnabledForLeague = leagueSeason?.playoffs_enabled || false;
    const playoffsActive = weekToLoad >= 17 && playoffsEnabledForLeague;
    
    setIsPlayoffs(playoffsActive);

    // Check if ANY games for the week have started (locked)
    const { data: lockedGames } = await supabase
      .from('games')
      .select('id')
      .eq('season', 2025)
      .eq('week', weekToLoad)
      .lt('game_utc', now.toISOString());
    
    setAnyGamesLocked(!!(lockedGames && lockedGames.length > 0));

    let seasonTotal = 0;
    let weekTotal = 0;

    if (playoffsActive) {
      // Load playoff picks
      const { data: roundData } = await supabase
        .from('playoff_rounds_v2')
        .select('id, week')
        .eq('league_season_id', leagueId)
        .eq('week', weekToLoad)
        .limit(1)
        .maybeSingle();

      if (roundData) {
        // Load my playoff picks
        const { data: myPicksData } = await supabase
          .from('playoff_picks_v2')
          .select(`
            id,
            profile_id,
            team_id,
            pick_position,
            game_id,
            points,
            team:teams(short_name, abbreviation, color_primary, logo),
            game:games(status, home_team, away_team, home_score, away_score, game_utc)
          `)
          .eq('playoff_round_id', roundData.id)
          .eq('profile_id', user.id);

        const transformedMyPicks = (myPicksData || []).map((p: any) => ({
          ...p,
          team: Array.isArray(p.team) ? p.team[0] : p.team,
          game: Array.isArray(p.game) ? p.game[0] : p.game,
          points: p.points || 0,
        }));

        setPlayoffPicks(transformedMyPicks);
        weekTotal = transformedMyPicks.reduce((sum: number, p: PlayoffPick) => sum + p.points, 0);

        // Load league playoff picks
        const { data: leaguePicksData } = await supabase
          .from('playoff_picks_v2')
          .select(`
            id,
            profile_id,
            team_id,
            pick_position,
            game_id,
            points,
            team:teams(short_name, abbreviation, color_primary, logo),
            game:games(status, home_team, away_team, home_score, away_score, game_utc),
            profile:profiles(display_name, profile_color)
          `)
          .eq('playoff_round_id', roundData.id)
          .neq('profile_id', user.id);

        const transformedLeaguePicks = (leaguePicksData || []).map((p: any) => ({
          ...p,
          team: Array.isArray(p.team) ? p.team[0] : p.team,
          game: Array.isArray(p.game) ? p.game[0] : p.game,
          profile: Array.isArray(p.profile) ? p.profile[0] : p.profile,
          points: p.points || 0,
        }));

        // Only show picks where games have locked
        const lockedLeaguePicks = transformedLeaguePicks.filter((p: PlayoffPick) =>
          new Date(p.game.game_utc) <= now
        );

        setLeaguePlayoffPicks(lockedLeaguePicks);
      }

      // Clear regular picks
      setWeekPicks([]);
      setLeaguePicks([]);
      setWrinklePicks([]);
      setLeagueWrinklePicks([]);
    } else {
      // Load regular season picks (existing logic)
      const { data: allPicks } = await supabase
        .from('picks_v2')
        .select(`
          id,
          week,
          team_id,
          game_id,
          points,
          multiplier,
          locked_at,
          profile_id,
          auto_assigned,
          team:teams(short_name, abbreviation, color_primary, logo),
          game:games(status, home_team, away_team, home_score, away_score, game_utc),
          profile:profiles(display_name, profile_color)
        `)
        .eq('league_season_id', leagueId)
        .eq('profile_id', user.id);

      if (allPicks) {
        const picks = (allPicks as unknown as Pick[]).map(p => ({
          ...p,
          multiplier: p.multiplier || 1,
        }));
        setWeekPicks(picks.filter(p => p.week === weekToLoad));
        seasonTotal = picks.reduce((sum, p) => sum + (p.points || 0), 0);
        weekTotal = picks.filter(p => p.week === weekToLoad).reduce((sum, p) => sum + (p.points || 0), 0);
      } else {
        setWeekPicks([]);
      }

      // Get ALL league picks for current week
      const { data: allLeaguePicks } = await supabase
        .from('picks_v2')
        .select(`
          id,
          week,
          team_id,
          game_id,
          points,
          multiplier,
          locked_at,
          profile_id,
          auto_assigned,
          team:teams(short_name, abbreviation, color_primary, logo),
          game:games(status, home_team, away_team, home_score, away_score, game_utc),
          profile:profiles(display_name, profile_color)
        `)
        .eq('league_season_id', leagueId)
        .eq('week', weekToLoad);

      if (allLeaguePicks) {
        const picks = (allLeaguePicks as unknown as Pick[]).map(p => ({
          ...p,
          multiplier: p.multiplier || 1,
        }));
        
        const lockedPicks = picks.filter(p => {
          const isLocked = !!p.locked_at || new Date(p.game.game_utc) < now;
          return isLocked;
        });
        
        setLeaguePicks(lockedPicks);
      } else {
        setLeaguePicks([]);
      }

      // Get wrinkle picks
      const { data: allLeagueWrinklePicks } = await supabase
        .from('wrinkle_picks_v2')
        .select(`
          id,
          wrinkle_id,
          team_id,
          points,
          profile_id,
          wrinkle:wrinkles_v2!inner(
            name,
            kind,
            week,
            league_season_id,
            game:games(status, home_team, away_team, home_score, away_score, game_utc)
          ),
          team:teams(short_name, abbreviation, color_primary, logo),
          profile:profiles(display_name, profile_color)
        `)
        .eq('wrinkles_v2.league_season_id', leagueId)
        .eq('wrinkles_v2.week', weekToLoad);

      if (allLeagueWrinklePicks) {
        const wPicks = allLeagueWrinklePicks as unknown as WrinklePick[];
        const lockedWrinklePicks = wPicks.filter(p => {
          if (p.wrinkle?.kind === 'bonus_game_oof') {
            return false;
          }
          return true;
        });
        
        setLeagueWrinklePicks(lockedWrinklePicks);
      } else {
        setLeagueWrinklePicks([]);
      }

      // Get user's wrinkle picks
      const { data: allWrinklePicks } = await supabase
        .from('wrinkle_picks_v2')
        .select(`
          id,
          wrinkle_id,
          team_id,
          points,
          profile_id,
          wrinkle:wrinkles_v2(
            name,
            kind,
            week,
            league_season_id,
            game:games(status, home_team, away_team, home_score, away_score, game_utc)
          ),
          team:teams(short_name, abbreviation, color_primary, logo)
        `)
        .eq('profile_id', user.id);

      if (allWrinklePicks) {
        const wPicks = allWrinklePicks as unknown as WrinklePick[];
        const filteredWrinklePicks = wPicks.filter(
          p => p.wrinkle?.league_season_id === leagueId && p.wrinkle?.week === weekToLoad
        );
        setWrinklePicks(filteredWrinklePicks);
        
        const leagueWrinklePicks = wPicks.filter(p => p.wrinkle?.league_season_id === leagueId);
        seasonTotal += leagueWrinklePicks.reduce((sum, p) => sum + (p.points || 0), 0);
        weekTotal += filteredWrinklePicks.reduce((sum, p) => sum + (p.points || 0), 0);
      } else {
        setWrinklePicks([]);
      }

      // Clear playoff picks
      setPlayoffPicks([]);
      setLeaguePlayoffPicks([]);
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
    const handleLeagueChange = () => {
      const newLeagueId = localStorage.getItem('activeLeagueSeasonId');
      if (newLeagueId) {
        setLeagueSeasonId(newLeagueId);
        loadData(newLeagueId);
      }
    };

    window.addEventListener('leagueChanged', handleLeagueChange);
    return () => window.removeEventListener('leagueChanged', handleLeagueChange);
  }, [loadData]);

  const PickCard = ({ pick, showName = false, showReactions = false }: { pick: Pick; showName?: boolean; showReactions?: boolean }) => {
    const isLocked = !!pick.locked_at || new Date(pick.game.game_utc) < new Date();
    const isComplete = pick.game.status === 'FINAL';
    const isHome = pick.team_id === pick.game.home_team;
    const teamScore = isHome ? pick.game.home_score : pick.game.away_score;
    const oppScore = isHome ? pick.game.away_score : pick.game.home_score;
    const isWinner = isComplete && teamScore !== null && oppScore !== null && teamScore > oppScore;
    const gameTime = new Date(pick.game.game_utc);
    const multiplier = pick.multiplier || 1;

    return (
      <Paper
        sx={{
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: pick.team.color_primary,
          color: 'white',
          borderRadius: 2,
          border: isComplete ? 3 : 0,
          borderColor: isWinner ? 'success.main' : 'error.main',
          position: 'relative',
        }}
      >
        {multiplier > 1 && (
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: 'secondary.main',
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              border: '2px solid',
              borderColor: 'background.paper',
              zIndex: 1,
            }}
          >
            x{multiplier}
          </Box>
        )}

        {pick.auto_assigned && (
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              left: -8,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: 'warning.main',
              color: 'white',
              fontSize: 10,
              fontWeight: 700,
              border: '2px solid',
              borderColor: 'background.paper',
              zIndex: 1,
            }}
          >
            AUTO
          </Box>
        )}
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={pick.team.logo}
              alt={pick.team.short_name}
              sx={{ width: 24, height: 24, objectFit: 'contain' }}
            />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {showName && pick.profile && (
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {pick.profile.display_name}
              </Typography>
            )}
            <Typography variant="body2" fontWeight={600} noWrap>
              {pick.team.short_name}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {isComplete 
                ? `${teamScore} - ${oppScore}` 
                : gameTime.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
              }
            </Typography>
          </Box>
          {isComplete && (
            <Typography variant="body1" fontWeight={700}>
              {isWinner ? `+${pick.points}` : '0'}
            </Typography>
          )}
          {isLocked && !isComplete && <Lock fontSize="small" sx={{ opacity: 0.7 }} />}
        </Box>

        {showReactions && isLocked && userId && (
          <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <Reactions pickId={pick.id} currentUserId={userId} />
          </Box>
        )}
      </Paper>
    );
  };

  const PlayoffPickCard = ({ pick, showName = false, showReactions = false }: { pick: PlayoffPick; showName?: boolean; showReactions?: boolean }) => {
    const isComplete = pick.game.status === 'FINAL';
    const isHome = pick.team_id === pick.game.home_team;
    const teamScore = isHome ? pick.game.home_score : pick.game.away_score;
    const oppScore = isHome ? pick.game.away_score : pick.game.home_score;
    const isWinner = isComplete && teamScore !== null && oppScore !== null && teamScore > oppScore;
    const gameTime = new Date(pick.game.game_utc);
    const gameLocked = gameTime <= new Date();

    return (
      <Paper
        sx={{
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: pick.team.color_primary,
          color: 'white',
          borderRadius: 2,
          border: isComplete ? 3 : 0,
          borderColor: isWinner ? 'success.main' : 'error.main',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={pick.team.logo}
              alt={pick.team.short_name}
              sx={{ width: 24, height: 24, objectFit: 'contain' }}
            />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {showName && pick.profile && (
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {pick.profile.display_name}
              </Typography>
            )}
            <Typography variant="body2" fontWeight={600} noWrap>
              {pick.team.short_name}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {isComplete 
                ? `${teamScore} - ${oppScore}` 
                : `Pick #${pick.pick_position}`
              }
            </Typography>
          </Box>
          {isComplete && (
            <Typography variant="body1" fontWeight={700}>
              {isWinner ? `+${pick.points}` : '0'}
            </Typography>
          )}
          {gameLocked && !isComplete && <Lock fontSize="small" sx={{ opacity: 0.7 }} />}
        </Box>

        {showReactions && gameLocked && userId && (
          <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <Reactions pickId={pick.id} currentUserId={userId} />
          </Box>
        )}
      </Paper>
    );
  };

  const WrinklePickCard = ({ pick, showName = false, showReactions = false }: { pick: WrinklePick; showName?: boolean; showReactions?: boolean }) => {
    const isLocked = true;
    
    if (!pick.wrinkle.game) {
      return (
        <Paper
          sx={{
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            bgcolor: pick.team.color_primary,
            color: 'white',
            borderRadius: 2,
            position: 'relative',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: 'secondary.main',
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              border: '2px solid',
              borderColor: 'background.paper',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            <Stars sx={{ fontSize: 12 }} />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                component="img"
                src={pick.team.logo}
                alt={pick.team.short_name}
                sx={{ width: 24, height: 24, objectFit: 'contain' }}
              />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              {showName && pick.profile && (
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {pick.profile.display_name}
                </Typography>
              )}
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {pick.wrinkle.name}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {pick.team.short_name}
              </Typography>
            </Box>
            {pick.points > 0 && (
              <Typography variant="body1" fontWeight={700}>
                +{pick.points}
              </Typography>
            )}
          </Box>
          
          {showReactions && isLocked && userId && (
            <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <Reactions pickId={pick.id} currentUserId={userId} />
            </Box>
          )}
        </Paper>
      );
    }

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
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: pick.team.color_primary,
          color: 'white',
          borderRadius: 2,
          border: isComplete ? 3 : 0,
          borderColor: isWinner ? 'success.main' : 'error.main',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -8,
            right: -8,
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: 'secondary.main',
            color: 'white',
            fontSize: 11,
            fontWeight: 700,
            border: '2px solid',
            borderColor: 'background.paper',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
          }}
        >
          <Stars sx={{ fontSize: 12 }} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={pick.team.logo}
              alt={pick.team.short_name}
              sx={{ width: 24, height: 24, objectFit: 'contain' }}
            />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {showName && pick.profile && (
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {pick.profile.display_name}
              </Typography>
            )}
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {pick.wrinkle.name}
            </Typography>
            <Typography variant="body2" fontWeight={600} noWrap>
              {pick.team.short_name}
            </Typography>
          </Box>
          {isComplete && (
            <Typography variant="body1" fontWeight={700}>
              {isWinner ? `+${pick.points}` : '0'}
            </Typography>
          )}
        </Box>

        {showReactions && isLocked && userId && (
          <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <Reactions pickId={pick.id} currentUserId={userId} />
          </Box>
        )}
      </Paper>
    );
  };

  // Combine all picks for display
  type AllPick = 
    | (Pick & { pickType: 'regular' }) 
    | (WrinklePick & { pickType: 'wrinkle' })
    | (PlayoffPick & { pickType: 'playoff' });
  
  const allLeaguePicksCombined: AllPick[] = isPlayoffs
    ? leaguePlayoffPicks.map(p => ({ ...p, pickType: 'playoff' as const }))
    : [
        ...leaguePicks.map(p => ({ ...p, pickType: 'regular' as const })),
        ...leagueWrinklePicks.map(p => ({ ...p, pickType: 'wrinkle' as const })),
      ];

  const groupedLeaguePicks = allLeaguePicksCombined.reduce((acc, pick) => {
    const name = pick.profile?.display_name || 'Unknown';
    if (!acc[name]) acc[name] = [];
    acc[name].push(pick);
    return acc;
  }, {} as Record<string, AllPick[]>);

  const myPicksCount = isPlayoffs ? playoffPicks.length : weekPicks.length;
  const expectedPicks = isPlayoffs ? 4 : 2;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left Column - Picks */}
      <Box sx={{ width: 280, p: 2, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
        <WeekPicker 
          currentWeek={currentWeek}
          viewingWeek={viewingWeek}
          onWeekChange={(week) => leagueSeasonId && loadData(leagueSeasonId, week)}
        />

        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            {/* My Picks */}
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  My Picks {isPlayoffs && '(Playoffs)'}
                </Typography>
                <Chip 
                  icon={myPicksCount >= expectedPicks ? <Check /> : undefined}
                  label={`${myPicksCount}/${expectedPicks}`}
                  size="small"
                  color={myPicksCount >= expectedPicks ? 'success' : 'default'}
                />
              </Stack>

              {myPicksCount === 0 ? (
                <Button 
                  variant="outlined" 
                  size="small"
                  fullWidth
                  onClick={() => router.push(isPlayoffs ? '/playoffs' : '/picks')}
                >
                  Make Picks
                </Button>
              ) : (
                <Stack spacing={1}>
                  {isPlayoffs ? (
                    playoffPicks.map((pick) => (
                      <PlayoffPickCard key={pick.id} pick={pick} />
                    ))
                  ) : (
                    <>
                      {weekPicks.map((pick) => (
                        <PickCard key={pick.id} pick={pick} />
                      ))}
                      {wrinklePicks.map((pick) => (
                        <WrinklePickCard key={pick.id} pick={pick} />
                      ))}
                    </>
                  )}
                </Stack>
              )}

              {/* Week/Season Points */}
              <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Week</Typography>
                  <Typography variant="body2" fontWeight={600}>{weekPoints} pts</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Season</Typography>
                  <Typography variant="body2" fontWeight={700}>{seasonPoints} pts</Typography>
                </Stack>
              </Paper>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* League Picks */}
            <Box>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                <Group fontSize="small" color="action" />
                <Typography variant="subtitle2" color="text.secondary">
                  League Picks
                </Typography>
              </Stack>

              {!anyGamesLocked ? (
                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                  Visible as games lock
                </Typography>
              ) : allLeaguePicksCombined.length === 0 ? (
                <Typography variant="caption" color="text.disabled">
                  No locked picks yet
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {Object.entries(groupedLeaguePicks).map(([name, picks]) => (
                    <Box key={name}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {name}
                      </Typography>
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        {picks.map((pick) => 
                          pick.pickType === 'playoff' ? (
                            <PlayoffPickCard key={`playoff-${pick.id}`} pick={pick} showReactions />
                          ) : pick.pickType === 'regular' ? (
                            <PickCard key={`regular-${pick.id}`} pick={pick} showReactions />
                          ) : (
                            <WrinklePickCard key={`wrinkle-${pick.id}`} pick={pick} showReactions />
                          )
                        )}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Center - Main Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        {children}
      </Box>

      {/* Right Column - NFL Scores */}
      <Box sx={{ width: 300, p: 2, borderLeft: 1, borderColor: 'divider', overflow: 'auto' }}>
        <NFLScores />
      </Box>
    </Box>
  );
}
