import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/playoffs/transition - Process playoff transitions (called by GitHub Action)
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Optional: Verify this is called by GitHub Action with a secret
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.PLAYOFF_TRANSITION_SECRET;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    // Allow without auth for manual testing, but log it
    console.log('Transition called without auth token');
  }

  const results: any = {
    processed: [],
    errors: [],
  };

  // Get all leagues with playoffs enabled
  const { data: settings, error: settingsError } = await supabase
    .from('playoff_settings_v2')
    .select('*, league_season:league_seasons_v2(id, season)')
    .eq('enabled', true);

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  if (!settings || settings.length === 0) {
    return NextResponse.json({ message: 'No leagues with playoffs enabled', results });
  }

  // Determine current NFL week based on games
  const now = new Date();
  const { data: nextGame } = await supabase
    .from('games')
    .select('week')
    .eq('season', 2025)
    .gte('game_utc', now.toISOString())
    .order('game_utc', { ascending: true })
    .limit(1)
    .single();

  const currentWeek = nextGame?.week || 18;

  for (const setting of settings) {
    const leagueSeasonId = setting.league_season_id;
    const regularSeasonWeeks = setting.regular_season_weeks || 16;

    try {
      // Check if we need to initialize Week 17
      if (currentWeek === regularSeasonWeeks + 1) { // Week 17
        const { data: existingRound } = await supabase
          .from('playoff_rounds_v2')
          .select('id')
          .eq('league_season_id', leagueSeasonId)
          .eq('week', 17)
          .single();

        if (!existingRound) {
          // Initialize Week 17
          const initRes = await initializeWeek17(supabase, leagueSeasonId);
          results.processed.push({
            leagueSeasonId,
            action: 'initialized_week_17',
            ...initRes,
          });
        }
      }

      // Check if we need to transition to Week 18
      if (currentWeek === regularSeasonWeeks + 2) { // Week 18
        const { data: week17Round } = await supabase
          .from('playoff_rounds_v2')
          .select('id, status')
          .eq('league_season_id', leagueSeasonId)
          .eq('week', 17)
          .eq('round_type', 'semifinal')
          .single();

        const { data: week18Round } = await supabase
          .from('playoff_rounds_v2')
          .select('id')
          .eq('league_season_id', leagueSeasonId)
          .eq('week', 18)
          .single();

        // If Week 17 exists but Week 18 doesn't, initialize Week 18
        if (week17Round && !week18Round) {
          // First, mark Week 17 as complete
          await supabase
            .from('playoff_rounds_v2')
            .update({ status: 'complete' })
            .eq('id', week17Round.id);

          // Initialize Week 18
          const initRes = await initializeWeek18(supabase, leagueSeasonId);
          results.processed.push({
            leagueSeasonId,
            action: 'initialized_week_18',
            ...initRes,
          });
        }
      }

      // Update round statuses based on draft timing
      await updateRoundStatuses(supabase, leagueSeasonId, now);

      // Score completed games
      await scoreCompletedGames(supabase, leagueSeasonId);

    } catch (err: any) {
      results.errors.push({
        leagueSeasonId,
        error: err.message,
      });
    }
  }

  return NextResponse.json({
    message: 'Transition processing complete',
    currentWeek,
    results,
  });
}

async function initializeWeek17(supabase: any, leagueSeasonId: string) {
  // Get standings from regular season
  const { data: standings } = await supabase
    .from('picks_v2')
    .select('profile_id, points')
    .eq('league_season_id', leagueSeasonId);

  const pointsMap = new Map<string, number>();
  standings?.forEach((pick: any) => {
    const current = pointsMap.get(pick.profile_id) || 0;
    pointsMap.set(pick.profile_id, current + (pick.points || 0));
  });

  const rankedPlayers = Array.from(pointsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([profileId, points], index) => ({
      profileId,
      points,
      seed: index + 1,
    }));

  // Draft starts Tuesday 9am EST
  const draftStart = getNextTuesday9am();

  // Create Semifinal round
  const { data: semifinalRound } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 17,
      round_type: 'semifinal',
      status: 'pending',
      draft_start_time: draftStart.toISOString(),
    })
    .select()
    .single();

  // Create Non-playoff round
  const { data: nonPlayoffRound } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 17,
      round_type: 'non_playoff',
      status: 'pending',
      draft_start_time: draftStart.toISOString(),
    })
    .select()
    .single();

  // Add participants
  for (const player of rankedPlayers) {
    const isPlayoff = player.seed <= 4;
    const roundId = isPlayoff ? semifinalRound.id : nonPlayoffRound.id;

    await supabase
      .from('playoff_participants_v2')
      .insert({
        playoff_round_id: roundId,
        profile_id: player.profileId,
        seed: player.seed,
        picks_available: 4,
      });
  }

  return { semifinalRoundId: semifinalRound.id, participantCount: rankedPlayers.length };
}

async function initializeWeek18(supabase: any, leagueSeasonId: string) {
  // Get Week 17 semifinal results
  const { data: week17Round } = await supabase
    .from('playoff_rounds_v2')
    .select('id')
    .eq('league_season_id', leagueSeasonId)
    .eq('week', 17)
    .eq('round_type', 'semifinal')
    .single();

  if (!week17Round) {
    throw new Error('Week 17 semifinal not found');
  }

  // Get participants with their playoff points
  const { data: participants } = await supabase
    .from('playoff_participants_v2')
    .select('profile_id, seed')
    .eq('playoff_round_id', week17Round.id);

  const { data: picks } = await supabase
    .from('playoff_picks_v2')
    .select('profile_id, points')
    .eq('playoff_round_id', week17Round.id);

  const pointsMap = new Map<string, number>();
  picks?.forEach((pick: any) => {
    const current = pointsMap.get(pick.profile_id) || 0;
    pointsMap.set(pick.profile_id, current + (pick.points || 0));
  });

  // Rank by Week 17 points (tiebreaker: regular season seed)
  const ranked = participants
    ?.map((p: any) => ({
      profileId: p.profile_id,
      points: pointsMap.get(p.profile_id) || 0,
      regularSeasonSeed: p.seed,
    }))
    .sort((a: any, b: any) => 
      b.points - a.points || a.regularSeasonSeed - b.regularSeasonSeed
    ) || [];

  const draftStart = getNextTuesday9am();

  // Get SNF game for tiebreaker
  const { data: snfGame } = await supabase
    .from('games')
    .select('id')
    .eq('season', 2025)
    .eq('week', 18)
    .order('game_utc', { ascending: false })
    .limit(1)
    .single();

  // Create Championship round (top 2)
  const { data: champRound } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 18,
      round_type: 'championship',
      status: 'pending',
      draft_start_time: draftStart.toISOString(),
      tiebreaker_game_id: snfGame?.id,
    })
    .select()
    .single();

  // Create Consolation round (3rd & 4th)
  const { data: consolationRound } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 18,
      round_type: 'consolation',
      status: 'pending',
      draft_start_time: draftStart.toISOString(),
    })
    .select()
    .single();

  // Create Non-playoff round
  const { data: nonPlayoffRound } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 18,
      round_type: 'non_playoff',
      status: 'pending',
      draft_start_time: draftStart.toISOString(),
    })
    .select()
    .single();

  // Add championship participants (top 2)
  for (let i = 0; i < Math.min(2, ranked.length); i++) {
    await supabase.from('playoff_participants_v2').insert({
      playoff_round_id: champRound.id,
      profile_id: ranked[i].profileId,
      seed: i + 1,
      picks_available: 4,
    });
  }

  // Add consolation participants (3rd & 4th)
  for (let i = 2; i < Math.min(4, ranked.length); i++) {
    await supabase.from('playoff_participants_v2').insert({
      playoff_round_id: consolationRound.id,
      profile_id: ranked[i].profileId,
      seed: i + 1,
      picks_available: 4,
    });
  }

  // Get all league participants for non-playoff
  const { data: allParticipants } = await supabase
    .from('league_season_participants_v2')
    .select('profile_id')
    .eq('league_season_id', leagueSeasonId)
    .eq('active', true);

  const playoffIds = new Set(ranked.slice(0, 4).map((p: any) => p.profileId));

  for (const p of allParticipants || []) {
    if (!playoffIds.has(p.profile_id)) {
      await supabase.from('playoff_participants_v2').insert({
        playoff_round_id: nonPlayoffRound.id,
        profile_id: p.profile_id,
        seed: null,
        picks_available: 4,
      });
    }
  }

  return { championshipRoundId: champRound.id };
}

async function updateRoundStatuses(supabase: any, leagueSeasonId: string, now: Date) {
  // Get all rounds for this league
  const { data: rounds } = await supabase
    .from('playoff_rounds_v2')
    .select('*')
    .eq('league_season_id', leagueSeasonId)
    .in('status', ['pending', 'drafting', 'open']);

  for (const round of rounds || []) {
    if (!round.draft_start_time) continue;

    const draftStart = new Date(round.draft_start_time);

    if (now >= draftStart && round.status === 'pending') {
      await supabase
        .from('playoff_rounds_v2')
        .update({ status: 'drafting' })
        .eq('id', round.id);
    }

    // TODO: Calculate when draft ends and update to 'open'
  }
}

async function scoreCompletedGames(supabase: any, leagueSeasonId: string) {
  // Get all playoff picks that need scoring
  const { data: rounds } = await supabase
    .from('playoff_rounds_v2')
    .select('id')
    .eq('league_season_id', leagueSeasonId);

  if (!rounds) return;

  const roundIds = rounds.map((r: any) => r.id);

  const { data: picks } = await supabase
    .from('playoff_picks_v2')
    .select(`
      id,
      team_id,
      points,
      game:games(id, status, home_team, away_team, home_score, away_score)
    `)
    .in('playoff_round_id', roundIds)
    .is('points', null);

  for (const pick of picks || []) {
    const game = pick.game;
    if (!game || game.status !== 'FINAL') continue;

    const isHome = pick.team_id === game.home_team;
    const teamScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;
    const won = teamScore > oppScore;
    const points = won ? teamScore : 0;

    await supabase
      .from('playoff_picks_v2')
      .update({ points })
      .eq('id', pick.id);
  }
}

function getNextTuesday9am(): Date {
  const now = new Date();
  const tuesday = new Date(now);
  
  // Find next Tuesday
  const daysUntilTuesday = (2 - now.getDay() + 7) % 7 || 7;
  tuesday.setDate(now.getDate() + daysUntilTuesday);
  
  // Set to 9am EST (14:00 UTC)
  tuesday.setUTCHours(14, 0, 0, 0);
  
  return tuesday;
}
