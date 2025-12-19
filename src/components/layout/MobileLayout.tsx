'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Tabs, Tab, Typography, Stack, Chip, CircularProgress, Button, Menu, MenuItem } from '@mui/material';
import { SportsFootball, Leaderboard, EmojiEvents, Check, Lock, Stars, ExpandMore } from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NFLScores from './NFLScores';
import Standings from './Standings';
import Reactions from '@/components/Reactions';

type Pick = {
  id: string;
  week: number;
  team_id: string;
  game_id: string;
  points: number;
  multiplier: number;
  locked_at: string | null;
  profile_id: string;
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
    game: {
      status: string;
      home_team: string;
      away_team: string;
      home_score: number | null;
      away_score: number | null;
    } | null;
  };
  team: {
    short_name: string;
    abbreviation: string;
    color_primary: string;
    logo: string;
  };
  profile?: {
    display_name: string;
    profile_color: string;
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
  const router = useRouter();
  const pathname = usePathname();
  
  // For non-dashboard pages, just render children
  const isTabRoute = pathname === '/' || pathname === '/picks' || pathname === '/playoffs';
  if (!isTabRoute) {
    return <Box sx={{ p: 2, overflow: 'auto', height: 'calc(100vh - 56px)' }}>{children}</Box>;
  }
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [viewingWeek, setViewingWeek] = useState(1);
  const [weekPicks, setWeekPicks] = useState<Pick[]>([]);
  const [leaguePicks, setLeaguePicks] = useState<Pick[]>([]);
  const [leagueWrinklePicks, setLeagueWrinklePicks] = useState<WrinklePick[]>([]);
  const [wrinklePicks, setWrinklePicks] = useState<WrinklePick[]>([]);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [weekPoints, setWeekPoints] = useState(0);
  const [leagueSeasonId, setLeagueSeasonId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [anyGamesLocked, setAnyGamesLocked] = useState(false);
  const [weekMenuAnchor, setWeekMenuAnchor] = useState<null | HTMLElement>(null);

  const supabase = createClient();

  const loadData = useCallback(async (leagueId: string, week?: number) => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const now = new Date();
    const { data: nextGame } = await supabase
      .from('games')
      .select('week')
      .eq('season', 2025)
      .gte('game_utc', now.toISOString())
      .order('game_utc', { ascending: true })
      .limit(1)
      .single();

    const actualCurrentWeek = nextGame?.week || 1;
    setCurrentWeek(actualCurrentWeek);
    
    const weekToLoad = week !== undefined ? week : actualCurrentWeek;
    setViewingWeek(weekToLoad);

    // Check if ANY games for the week have started (locked)
    const { data: lockedGames } = await supabase
      .from('games')
      .select('id')
      .eq('season', 2025)
      .eq('week', weekToLoad)
      .lt('game_utc', now.toISOString());
    
    setAnyGamesLocked(!!(lockedGames && lockedGames.length > 0));

    // Get user's picks
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
        team:teams(short_name, abbreviation, color_primary, logo),
        game:games(status, home_team, away_team, home_score, away_score, game_utc),
        profile:profiles(display_name, profile_color)
      `)
      .eq('league_season_id', leagueId)
      .eq('profile_id', user.id);

    let seasonTotal = 0;
    let weekTotal = 0;

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

    // Get ALL league picks for the week
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

    // Get ALL league wrinkle picks for the week
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
          game:games(status, home_team, away_team, home_score, away_score)
        ),
        team:teams(short_name, abbreviation, color_primary, logo),
        profile:profiles(display_name, profile_color)
      `)
      .eq('wrinkles_v2.league_season_id', leagueId)
      .eq('wrinkles_v2.week', weekToLoad);

    if (allLeagueWrinklePicks) {
      const wPicks = allLeagueWrinklePicks as unknown as WrinklePick[];
      setLeagueWrinklePicks(wPicks);
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
          game:games(status, home_team, away_team, home_score, away_score)
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

    setSeasonPoints(seasonTotal);
    setWeekPoints(weekTotal);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const storedLeagueId = localStorage.getItem('activeLeagueSeasonId');
    if (storedLeagueId) {
      setLeagueSeasonId(storedLeagueId);
      loadData(storedLeagueId);
    }
  }, [loadData]);

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

  const handleWeekSelect = (week: number) => {
    if (leagueSeasonId) {
      loadData(leagueSeasonId, week);
    }
    setWeekMenuAnchor(null);
  };

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

  // Group ALL league picks by user
  type AllPick = (Pick & { pickType: 'regular' }) | (WrinklePick & { pickType: 'wrinkle' });
  
  const allLeaguePicksCombined: AllPick[] = [
    ...leaguePicks.map(p => ({ ...p, pickType: 'regular' as const })),
    ...leagueWrinklePicks.map(p => ({ ...p, pickType: 'wrinkle' as const })),
  ];

  const groupedLeaguePicks = allLeaguePicksCombined.reduce((acc, pick) => {
    const name = pick.profile?.display_name || 'Unknown';
    if (!acc[name]) acc[name] = [];
    acc[name].push(pick);
    return acc;
  }, {} as Record<string, AllPick[]>);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      <Paper elevation={1} sx={{ borderRadius: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 48 }}
        >
          <Tab icon={<SportsFootball />} label="Picks" sx={{ minHeight: 48 }} />
          <Tab icon={<Leaderboard />} label="League" sx={{ minHeight: 48 }} />
          <Tab icon={<EmojiEvents />} label="Scores" sx={{ minHeight: 48 }} />
        </Tabs>
      </Paper>

      <TabPanel value={tab} index={0}>
        {/* Week Picker */}
        <Box 
          onClick={(e) => setWeekMenuAnchor(e.currentTarget)}
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 2,
            cursor: 'pointer',
            '&:hover': { opacity: 0.7 }
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            Week {viewingWeek}
          </Typography>
          <ExpandMore />
        </Box>

        <Menu
          anchorEl={weekMenuAnchor}
          open={Boolean(weekMenuAnchor)}
          onClose={() => setWeekMenuAnchor(null)}
        >
          {Array.from({ length: 18 }, (_, i) => i + 1).map((week) => (
            <MenuItem
              key={week}
              onClick={() => handleWeekSelect(week)}
              selected={week === viewingWeek}
              sx={{
                fontWeight: week === currentWeek ? 700 : 400,
                color: week === currentWeek ? 'primary.main' : 'inherit',
              }}
            >
              Week {week} {week === currentWeek && '(Current)'}
            </MenuItem>
          ))}
        </Menu>

        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            {/* My Picks */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" color="text.secondary">
                My Picks
              </Typography>
              <Chip 
                icon={weekPicks.length >= 2 ? <Check /> : undefined}
                label={`${weekPicks.length}/2`}
                size="small"
                color={weekPicks.length >= 2 ? 'success' : 'default'}
              />
            </Stack>

            {weekPicks.length === 0 ? (
              <Button 
                variant="outlined" 
                size="small"
                fullWidth
                onClick={() => router.push('/picks')}
                sx={{ mb: 2 }}
              >
                Make Picks
              </Button>
            ) : (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {weekPicks.map((pick) => (
                  <PickCard key={pick.id} pick={pick} />
                ))}
              </Stack>
            )}

            {wrinklePicks.length > 0 && (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {wrinklePicks.map((pick) => (
                  <WrinklePickCard key={pick.id} pick={pick} />
                ))}
              </Stack>
            )}

            {/* Week/Season Points */}
            <Paper variant="outlined" sx={{ p: 1.5, mb: 3 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Week</Typography>
                <Typography variant="body2" fontWeight={600}>{weekPoints} pts</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Season</Typography>
                <Typography variant="body2" fontWeight={700}>{seasonPoints} pts</Typography>
              </Stack>
            </Paper>

            {/* League Picks */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              League Picks
            </Typography>

            {!anyGamesLocked ? (
              <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                Visible as games lock
              </Typography>
            ) : allLeaguePicksCombined.length === 0 ? (
              <Typography variant="caption" color="text.disabled">
                No locked picks yet
              </Typography>
            ) : (
              <Stack spacing={2}>
                {Object.entries(groupedLeaguePicks).map(([name, picks]) => (
                  <Box key={name}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                      {name}
                    </Typography>
                    <Stack spacing={0.5}>
                      {picks.map((pick) => 
                        pick.pickType === 'regular' ? (
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
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Season Total</Typography>
                  <Typography variant="body1" fontWeight={700}>{seasonPoints} pts</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Week {viewingWeek}</Typography>
                  <Typography variant="body1" fontWeight={600}>{weekPoints} pts</Typography>
                </Stack>
              </Stack>
            </Paper>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Standings
            </Typography>
            <Standings />
          </>
        )}
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <NFLScores />
      </TabPanel>
    </Box>
  );
}
