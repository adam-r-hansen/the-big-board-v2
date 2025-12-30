'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Paper, Stack, Chip, LinearProgress, Alert } from '@mui/material';
import { EmojiEvents, TrendingUp, CalendarMonth, People, SportsFootball } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';
import AppShell from '@/components/layout/AppShell';
import Standings from '@/components/layout/Standings';
import PlayoffBracket from '@/components/playoffs/PlayoffBracket';
import type { User } from '@supabase/supabase-js';

type LeagueInfo = {
  id: string;
  league_id: string;
  season: number;
  playoffs_enabled?: boolean;
  leagues_v2: {
    id: string;
    name: string;
  };
};

type Team = {
  id: string;
  name: string;
  short_name: string;
  abbreviation: string;
  color_primary: string;
  logo: string;
};

type Game = {
  id: string;
  game_utc: string;
  status: string;
};

type PlayoffPick = {
  id: string;
  profile_id: string;
  team_id: string;
  pick_position: number;
  game_id: string;
  points: number;
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

type PlayoffRoundData = {
  participants: PlayoffParticipant[];
  picks: PlayoffPick[];
  week: number;
  roundType: 'semifinal' | 'championship' | 'consolation';
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [activeLeague, setActiveLeague] = useState<LeagueInfo | null>(null);
  
  // Dashboard stats
  const [currentWeek, setCurrentWeek] = useState(17);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalMembers, setTotalMembers] = useState(1);
  const [teamsRemaining, setTeamsRemaining] = useState(32);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [isPlayoffs, setIsPlayoffs] = useState(false);
  
  // Playoff data - now supporting multiple rounds
  const [championshipData, setChampionshipData] = useState<PlayoffRoundData | null>(null);
  const [consolationData, setConsolationData] = useState<PlayoffRoundData | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: participants } = await supabase
          .from('league_season_participants_v2')
          .select(`
            id,
            league_season_id,
            league_seasons_v2 (
              id,
              league_id,
              season,
              playoffs_enabled,
              leagues_v2 (
                id,
                name
              )
            )
          `)
          .eq('profile_id', user.id)
          .eq('active', true);

        if (participants && participants.length > 0) {
          const leagueList = participants
            .map((p: any) => p.league_seasons_v2)
            .filter(Boolean);
          
          setLeagues(leagueList);

          const storedLeagueId = localStorage.getItem('activeLeagueSeasonId');
          const active = leagueList.find((l: LeagueInfo) => l.id === storedLeagueId) || leagueList[0];
          
          if (active) {
            setActiveLeague(active);
            localStorage.setItem('activeLeagueSeasonId', active.id);

            // Check current week
            const { data: nextGame } = await supabase
              .from('games')
              .select('week')
              .eq('season', active.season)
              .gte('game_utc', new Date().toISOString())
              .order('game_utc', { ascending: true })
              .limit(1)
              .single();

            const latestWeek = nextGame?.week || 18;
            setCurrentWeek(latestWeek);
            const playoffsActive = latestWeek >= 17 && active.playoffs_enabled;
            setIsPlayoffs(playoffsActive);

            let debugMsg = `Current week: ${latestWeek}, Playoffs active: ${playoffsActive}`;

            // If playoffs are active, load playoff data for BOTH championship and consolation
            if (playoffsActive) {
              // Get championship round (Week 18)
              const { data: championshipRound, error: champError } = await supabase
                .from('playoff_rounds_v2')
                .select('id, round_type, week')
                .eq('league_season_id', active.id)
                .eq('week', 18)
                .eq('round_type', 'championship')
                .single();

              debugMsg += `\nChampionship round found: ${!!championshipRound}, Error: ${champError?.message || 'none'}`;

              if (championshipRound) {
                // Load championship participants
                const { data: champParticipants } = await supabase
                  .from('playoff_participants_v2')
                  .select(`
                    id,
                    profile_id,
                    seed,
                    picks_available,
                    profile:profiles!playoff_participants_v2_profile_id_fkey(display_name, email)
                  `)
                  .eq('playoff_round_id', championshipRound.id)
                  .order('seed', { ascending: true });

                debugMsg += `\nChampionship participants: ${champParticipants?.length || 0}`;

                const transformedChampParticipants = (champParticipants || []).map((p: any) => ({
                  ...p,
                  profile: Array.isArray(p.profile) ? p.profile[0] : p.profile
                }));

                // Load championship picks
                const { data: champPicks } = await supabase
                  .from('playoff_picks_v2')
                  .select(`
                    id,
                    profile_id,
                    team_id,
                    pick_position,
                    game_id,
                    points,
                    team:teams(id, name, short_name, abbreviation, color_primary, logo),
                    game:games(id, game_utc, status)
                  `)
                  .eq('playoff_round_id', championshipRound.id);

                debugMsg += `\nChampionship picks: ${champPicks?.length || 0}`;

                const transformedChampPicks = (champPicks || []).map((p: any) => ({
                  ...p,
                  team: Array.isArray(p.team) ? p.team[0] : p.team,
                  game: Array.isArray(p.game) ? p.game[0] : p.game,
                  points: p.points || 0,
                }));

                setChampionshipData({
                  participants: transformedChampParticipants,
                  picks: transformedChampPicks,
                  week: 18,
                  roundType: 'championship',
                });
              }

              // Get consolation round (Week 18)
              const { data: consolationRound, error: consolError } = await supabase
                .from('playoff_rounds_v2')
                .select('id, round_type, week')
                .eq('league_season_id', active.id)
                .eq('week', 18)
                .eq('round_type', 'consolation')
                .single();

              debugMsg += `\nConsolation round found: ${!!consolationRound}, Error: ${consolError?.message || 'none'}`;

              if (consolationRound) {
                // Load consolation participants
                const { data: consolParticipants } = await supabase
                  .from('playoff_participants_v2')
                  .select(`
                    id,
                    profile_id,
                    seed,
                    picks_available,
                    profile:profiles!playoff_participants_v2_profile_id_fkey(display_name, email)
                  `)
                  .eq('playoff_round_id', consolationRound.id)
                  .order('seed', { ascending: true });

                debugMsg += `\nConsolation participants: ${consolParticipants?.length || 0}`;

                const transformedConsolParticipants = (consolParticipants || []).map((p: any) => ({
                  ...p,
                  profile: Array.isArray(p.profile) ? p.profile[0] : p.profile
                }));

                // Load consolation picks
                const { data: consolPicks } = await supabase
                  .from('playoff_picks_v2')
                  .select(`
                    id,
                    profile_id,
                    team_id,
                    pick_position,
                    game_id,
                    points,
                    team:teams(id, name, short_name, abbreviation, color_primary, logo),
                    game:games(id, game_utc, status)
                  `)
                  .eq('playoff_round_id', consolationRound.id);

                debugMsg += `\nConsolation picks: ${consolPicks?.length || 0}`;

                const transformedConsolPicks = (consolPicks || []).map((p: any) => ({
                  ...p,
                  team: Array.isArray(p.team) ? p.team[0] : p.team,
                  game: Array.isArray(p.game) ? p.game[0] : p.game,
                  points: p.points || 0,
                }));

                setConsolationData({
                  participants: transformedConsolParticipants,
                  picks: transformedConsolPicks,
                  week: 18,
                  roundType: 'consolation',
                });
              }
            }

            setDebugInfo(debugMsg);

            // Load regular season stats
            const { data: standings } = await supabase
              .from('standings_v2')
              .select('*')
              .eq('league_season_id', active.id)
              .order('rank', { ascending: true });

            if (standings) {
              const userStanding = standings.find((s: any) => s.profile_id === user.id);
              setUserRank(userStanding?.rank || null);
              setSeasonPoints(userStanding?.total_points || 0);
              setTotalMembers(standings.length);
            }

            // Get teams remaining (through regular season only)
            const { data: picks } = await supabase
              .from('picks_v2')
              .select('team_id, week')
              .eq('profile_id', user.id)
              .eq('league_season_id', active.id)
              .lte('week', 16);

            const usedTeams = new Set(picks?.map((p: any) => p.team_id) || []);
            setTeamsRemaining(32 - usedTeams.size);
          }
        }
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const handleLeagueChange = (league: LeagueInfo) => {
    setActiveLeague(league);
    localStorage.setItem('activeLeagueSeasonId', league.id);
    window.location.reload();
  };

  if (loading) {
    return (
      <AppShell userEmail={user?.email} leagues={leagues} activeLeague={activeLeague}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </AppShell>
    );
  }

  const regularSeasonWeeks = 16;
  const weeksRemaining = Math.max(0, regularSeasonWeeks - currentWeek);
  const progressPercent = Math.min(100, (currentWeek / regularSeasonWeeks) * 100);

  return (
    <AppShell 
      userEmail={user?.email} 
      leagues={leagues} 
      activeLeague={activeLeague}
      onLeagueChange={handleLeagueChange}
    >
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, maxWidth: isPlayoffs ? '1400px' : '100%', mx: 'auto' }}>
        {/* Debug Info (temporary) */}
        {debugInfo && (
          <Alert severity="info" sx={{ mb: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {debugInfo}
          </Alert>
        )}

        {/* Season Progress */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonth />
            Season Progress
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progressPercent} 
            sx={{ height: 10, borderRadius: 5, mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary">
            {isPlayoffs 
              ? 'Regular season complete • Playoffs underway' 
              : `${weeksRemaining} weeks remaining in regular season`
            }
          </Typography>
        </Paper>

        {/* Championship Bracket */}
        {isPlayoffs && championshipData && (
          <Box sx={{ mb: 4 }}>
            <PlayoffBracket
              participants={championshipData.participants}
              picks={championshipData.picks}
              currentUserId={user?.id || null}
              week={championshipData.week}
              roundType={championshipData.roundType}
            />
          </Box>
        )}

        {/* Consolation Bracket (3rd Place) */}
        {isPlayoffs && consolationData && (
          <Box sx={{ mb: 4 }}>
            <PlayoffBracket
              participants={consolationData.participants}
              picks={consolationData.picks}
              currentUserId={user?.id || null}
              week={consolationData.week}
              roundType={consolationData.roundType}
            />
          </Box>
        )}

        {/* Regular Stats (shown for non-playoff weeks) */}
        {!isPlayoffs && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
              Your Stats
            </Typography>
            
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 3
            }}>
              <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                <EmojiEvents sx={{ fontSize: 48, color: 'warning.main', mb: 1 }} />
                <Typography variant="h3" fontWeight={700}>
                  #{userRank || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current Rank
                </Typography>
              </Paper>

              <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                <TrendingUp sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                <Typography variant="h3" fontWeight={700}>
                  {seasonPoints}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Season Points
                </Typography>
              </Paper>

              <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                <People sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
                <Typography variant="h3" fontWeight={700}>
                  {totalMembers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Members
                </Typography>
              </Paper>

              <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                <SportsFootball sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h3" fontWeight={700}>
                  {teamsRemaining}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Teams Left
                </Typography>
              </Paper>
            </Box>
          </>
        )}

        {/* Standings - hide during playoffs */}
        {!isPlayoffs && <Standings />}
      </Box>
    </AppShell>
  );
}
