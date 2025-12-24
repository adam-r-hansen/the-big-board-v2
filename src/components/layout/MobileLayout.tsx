'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Stack,
  CircularProgress,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  SportsFootball,
  Leaderboard,
  EmojiEvents,
  ExpandMore,
  Lock,
  LockOpen,
  CheckCircle,
} from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import Standings from './Standings';
import NFLScores from './NFLScores';
import Reactions from '@/components/reactions/Reactions';
import { isPickUnlocked, isDraftComplete, generateUnlockSchedule } from '@/lib/playoffs/unlockSchedule';

type Team = {
  id: string;
  name: string;
  short_name: string;
  abbreviation: string;
  color_primary: string;
  color_secondary: string;
  logo: string;
};

type Game = {
  id: string;
  game_utc: string;
};

type Pick = {
  id: string;
  team_id: string;
  week: number;
  points: number;
  status: string;
  team?: Team;
  game?: { status: string; game_utc: string };
  profile?: {
    display_name: string;
    profile_color: string;
  };
};

type WrinklePick = {
  id: string;
  team_id: string;
  wrinkle_type: string;
  points: number;
  status: string;
  team?: Team;
  game?: { status: string; game_utc: string };
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
  team?: Team;
  game?: Game;
};

type PlayoffParticipant = {
  id: string;
  profile_id: string;
  seed: number;
  picks_available: number;
  profile?: {
    display_name: string;
    email: string;
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
  
  // Playoff state
  const [isPlayoffs, setIsPlayoffs] = useState(false);
  const [playoffParticipants, setPlayoffParticipants] = useState<PlayoffParticipant[]>([]);
  const [playoffPicks, setPlayoffPicks] = useState<PlayoffPick[]>([]);
  const [draftStartTime, setDraftStartTime] = useState<Date | null>(null);
  const [roundType, setRoundType] = useState<'semifinal' | 'championship'>('semifinal');
  const [playoffWeek, setPlayoffWeek] = useState<number>(17);
  const [now] = useState(new Date());

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

    // Check if we're in playoffs
    const playoffsActive = weekToLoad >= 17;
    setIsPlayoffs(playoffsActive);

    // Check if ANY games for the week have started (locked)
    const { data: lockedGames } = await supabase
      .from('games')
      .select('id')
      .eq('season', 2025)
      .eq('week', weekToLoad)
      .lt('game_utc', now.toISOString());
    
    setAnyGamesLocked(!!lockedGames && lockedGames.length > 0);

    // Load regular picks
    const { data: picks } = await supabase
      .from('picks_v2')
      .select(`
        id, team_id, week, points, status,
        team:teams(id, name, short_name, abbreviation, color_primary, color_secondary, logo),
        game:games(status, game_utc)
      `)
      .eq('league_season_id', leagueId)
      .eq('profile_id', user.id)
      .eq('week', weekToLoad);

    setWeekPicks((picks as Pick[]) || []);

    const weekTotal = picks?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
    setWeekPoints(weekTotal);

    // Load league picks
    const { data: allPicks } = await supabase
      .from('picks_v2')
      .select(`
        id, team_id, week, points, status, profile_id,
        team:teams(id, name, short_name, abbreviation, color_primary, color_secondary, logo),
        game:games(status, game_utc),
        profile:profiles(display_name, profile_color)
      `)
      .eq('league_season_id', leagueId)
      .eq('week', weekToLoad)
      .neq('profile_id', user.id);

    setLeaguePicks((allPicks as Pick[]) || []);

    // Load wrinkle picks
    const { data: myWrinkles } = await supabase
      .from('wrinkle_picks_v2')
      .select(`
        id, team_id, wrinkle_type, points, status,
        team:teams(id, name, short_name, abbreviation, color_primary, color_secondary, logo),
        game:games(status, game_utc)
      `)
      .eq('league_season_id', leagueId)
      .eq('profile_id', user.id)
      .eq('week', weekToLoad);

    setWrinklePicks((myWrinkles as WrinklePick[]) || []);

    const wrinkleTotal = myWrinkles?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;

    // Load league wrinkle picks
    const { data: allWrinkles } = await supabase
      .from('wrinkle_picks_v2')
      .select(`
        id, team_id, wrinkle_type, points, status, profile_id,
        team:teams(id, name, short_name, abbreviation, color_primary, color_secondary, logo),
        game:games(status, game_utc),
        profile:profiles(display_name, profile_color)
      `)
      .eq('league_season_id', leagueId)
      .eq('week', weekToLoad)
      .neq('profile_id', user.id);

    setLeagueWrinklePicks((allWrinkles as WrinklePick[]) || []);

    // Load season total
    const { data: standings } = await supabase
      .from('standings_v2')
      .select('total_points')
      .eq('league_season_id', leagueId)
      .eq('profile_id', user.id)
      .single();

    setSeasonPoints(standings?.total_points || 0);

    // Load playoff data if in playoffs
    if (playoffsActive) {
      const { data: roundData } = await supabase
        .from('playoff_rounds_v2')
        .select('id, draft_start_time, round_type, week')
        .eq('league_season_id', leagueId)
        .in('week', [17, 18])
        .order('week', { ascending: false })
        .limit(1)
        .single();

      if (roundData) {
        setPlayoffWeek(roundData.week);
        setDraftStartTime(roundData.draft_start_time ? new Date(roundData.draft_start_time) : null);
        setRoundType(roundData.round_type as 'semifinal' | 'championship');

        const { data: participantsData } = await supabase
          .from('playoff_participants_v2')
          .select(`
            id,
            profile_id,
            seed,
            picks_available,
            profile:profiles!playoff_participants_v2_profile_id_fkey(display_name, email)
          `)
          .eq('playoff_round_id', roundData.id)
          .lte('seed', 4)
          .order('seed', { ascending: true });

        const transformedParticipants = (participantsData || []).map((p: any) => ({
          ...p,
          profile: Array.isArray(p.profile) ? p.profile[0] : p.profile
        }));

        setPlayoffParticipants(transformedParticipants);

        const { data: picksData } = await supabase
          .from('playoff_picks_v2')
          .select(`
            id,
            profile_id,
            team_id,
            pick_position,
            game_id,
            team:teams(id, name, short_name, abbreviation, color_primary, logo),
            game:games(id, game_utc)
          `)
          .eq('playoff_round_id', roundData.id);

        const transformedPicks = (picksData || []).map((p: any) => ({
          ...p,
          team: Array.isArray(p.team) ? p.team[0] : p.team,
          game: Array.isArray(p.game) ? p.game[0] : p.game,
        }));

        setPlayoffPicks(transformedPicks);
      }
    }

    setLoading(false);
  }, [supabase, now]);

  useEffect(() => {
    const leagueId = localStorage.getItem('activeLeagueSeasonId');
    if (leagueId) {
      setLeagueSeasonId(leagueId);
      loadData(leagueId);
    }
  }, [loadData]);

  const handleWeekSelect = (week: number) => {
    setWeekMenuAnchor(null);
    if (leagueSeasonId) {
      loadData(leagueSeasonId, week);
    }
  };

  // Check if a pick is unlocked for a user
  const isPickUnlockedForUser = (participant: PlayoffParticipant, pickPosition: number): boolean => {
    if (!draftStartTime) return false;
    const schedule = generateUnlockSchedule(playoffWeek as 17 | 18, draftStartTime, roundType);
    const draftComplete = isDraftComplete(schedule, now);
    if (draftComplete) return true;
    return isPickUnlocked(schedule, participant.seed, pickPosition, now);
  };

  // Check if game has started/locked
  const isGameLocked = (pick: PlayoffPick): boolean => {
    if (!pick.game?.game_utc) return false;
    return new Date(pick.game.game_utc) <= now;
  };

  const PickCard = ({ pick, showReactions = false }: { pick: Pick; showReactions?: boolean }) => {
    const isLocked = pick.game?.game_utc ? new Date(pick.game.game_utc) <= new Date() : false;
    const isComplete = pick.status === 'FINAL';
    const isWin = isComplete && (pick.points || 0) > 0;

    return (
      <Paper
        elevation={2}
        sx={{
          p: 1.5,
          bgcolor: pick.team?.color_primary || 'grey.800',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
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
            src={pick.team?.logo}
            alt={pick.team?.abbreviation}
            sx={{ width: 28, height: 28, objectFit: 'contain' }}
          />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {pick.team?.short_name}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {pick.team?.abbreviation}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'right' }}>
          {isComplete && (
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                bgcolor: isWin ? 'success.main' : 'error.main',
                px: 1,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              {isWin ? `+${pick.points}` : '0'}
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

  const WrinklePickCard = ({ pick, showReactions = false }: { pick: WrinklePick; showReactions?: boolean }) => {
    const isLocked = pick.game?.game_utc ? new Date(pick.game.game_utc) <= new Date() : false;
    const isComplete = pick.status === 'FINAL';
    const isWin = isComplete && (pick.points || 0) > 0;

    return (
      <Paper
        elevation={2}
        sx={{
          p: 1.5,
          bgcolor: pick.team?.color_primary || 'grey.800',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          border: '2px dashed rgba(255,255,255,0.5)',
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
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
            src={pick.team?.logo}
            alt={pick.team?.abbreviation}
            sx={{ width: 28, height: 28, objectFit: 'contain' }}
          />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {pick.team?.short_name}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {pick.wrinkle_type}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'right' }}>
          {isComplete && (
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                bgcolor: isWin ? 'success.main' : 'error.main',
                px: 1,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              {isWin ? `+${pick.points}` : '0'}
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
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              My Picks
            </Typography>

            {weekPicks.length === 0 && wrinklePicks.length === 0 ? (
              <Typography variant="body2" color="text.disabled">
                No picks for this week
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ mb: 3 }}>
                {weekPicks.map(pick => (
                  <PickCard key={pick.id} pick={pick} />
                ))}
                {wrinklePicks.map(pick => (
                  <WrinklePickCard key={pick.id} pick={pick} />
                ))}
              </Stack>
            )}

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 3 }}>
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

            {/* Playoff Teams (if playoffs active) */}
            {isPlayoffs && playoffParticipants.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <EmojiEvents sx={{ fontSize: 18, color: 'warning.main' }} />
                  Playoff Teams
                </Typography>
                <Stack spacing={1} sx={{ mb: 2 }}>
                  {playoffParticipants.map((participant) => {
                    const participantPicks = playoffPicks.filter(p => p.profile_id === participant.profile_id);
                    const isCurrentUser = participant.profile_id === userId;

                    return (
                      <Paper 
                        key={participant.id}
                        elevation={isCurrentUser ? 3 : 1}
                        sx={{ 
                          p: 1.5, 
                          border: 1,
                          borderColor: isCurrentUser ? 'primary.main' : 'divider',
                          bgcolor: isCurrentUser ? 'action.selected' : 'background.paper',
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <Chip 
                            label={`#${participant.seed}`} 
                            size="small" 
                            color={isCurrentUser ? 'primary' : 'default'}
                            sx={{ fontWeight: 700, height: 20, '& .MuiChip-label': { px: 1, fontSize: '0.7rem' } }}
                          />
                          <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }} noWrap>
                            {participant.profile?.display_name || participant.profile?.email?.split('@')[0]}
                          </Typography>
                          {isCurrentUser && (
                            <Typography variant="caption" color="primary.main" fontWeight={600}>
                              YOU
                            </Typography>
                          )}
                        </Stack>

                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          {participantPicks.length}/{participant.picks_available} picks
                        </Typography>

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
                          {[1, 2, 3, 4].map((position) => {
                            const pick = participantPicks.find(p => p.pick_position === position);
                            const unlocked = isCurrentUser && !pick && isPickUnlockedForUser(participant, position);
                            const gameLocked = pick ? isGameLocked(pick) : false;
                            
                            return (
                              <Box
                                key={position}
                                sx={{
                                  aspectRatio: '1',
                                  borderRadius: 1,
                                  bgcolor: pick 
                                    ? (gameLocked ? 'background.paper' : '#1e3a1e')
                                    : unlocked 
                                      ? '#1e2a3a' 
                                      : 'grey.800',
                                  border: pick 
                                    ? (gameLocked ? `1px solid ${pick.team?.color_primary}` : '1px solid #4caf50')
                                    : unlocked
                                      ? '2px solid #42a5f5'
                                      : '1px solid',
                                  borderColor: pick 
                                    ? (gameLocked ? pick.team?.color_primary : '#4caf50')
                                    : unlocked 
                                      ? '#42a5f5' 
                                      : 'grey.700',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: unlocked ? '0 0 8px rgba(66, 165, 245, 0.4)' : 'none',
                                }}
                              >
                                {pick ? (
                                  gameLocked ? (
                                    <Box
                                      component="img"
                                      src={pick.team?.logo}
                                      alt={pick.team?.abbreviation}
                                      sx={{ 
                                        width: '70%', 
                                        height: '70%', 
                                        objectFit: 'contain',
                                      }}
                                    />
                                  ) : (
                                    <CheckCircle sx={{ fontSize: 20, color: '#4caf50' }} />
                                  )
                                ) : unlocked ? (
                                  <LockOpen sx={{ fontSize: 16, color: '#42a5f5' }} />
                                ) : (
                                  <Lock sx={{ fontSize: 12, color: 'grey.600' }} />
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </>
            )}

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
