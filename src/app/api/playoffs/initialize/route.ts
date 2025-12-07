import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/playoffs/initialize - Initialize a playoff round
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { leagueSeasonId, week } = body;

  if (!leagueSeasonId || !week) {
    return NextResponse.json({ error: 'leagueSeasonId and week required' }, { status: 400 });
  }

  if (week !== 17 && week !== 18) {
    return NextResponse.json({ error: 'week must be 17 or 18' }, { status: 400 });
  }

  // Check if round already exists
  const { data: existingRound } = await supabase
    .from('playoff_rounds_v2')
    .select('id')
    .eq('league_season_id', leagueSeasonId)
    .eq('week', week)
    .single();

  if (existingRound) {
    return NextResponse.json({ error: 'Round already initialized' }, { status: 400 });
  }

  // Get standings from regular season (weeks 1-16) or Week 17
  const { data: standings, error: standingsError } = await supabase
    .from('picks_v2')
    .select('profile_id, points')
    .eq('league_season_id', leagueSeasonId);

  if (standingsError) {
    return NextResponse.json({ error: standingsError.message }, { status: 500 });
  }

  // Calculate total points per player
  const pointsMap = new Map<string, number>();
  standings?.forEach(pick => {
    const current = pointsMap.get(pick.profile_id) || 0;
    pointsMap.set(pick.profile_id, current + (pick.points || 0));
  });

  // Sort by points descending
  const rankedPlayers = Array.from(pointsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([profileId, points], index) => ({
      profileId,
      points,
      seed: index + 1,
    }));

  // Calculate draft start time (Tuesday 9am EST of playoff week)
  const draftStartTime = calculateDraftStartTime(week);

  if (week === 17) {
    // Week 17: Semifinals (top 4) + Non-playoff (5th+)
    return await initializeWeek17(supabase, leagueSeasonId, rankedPlayers, draftStartTime);
  } else {
    // Week 18: Need Week 17 results
    return await initializeWeek18(supabase, leagueSeasonId, draftStartTime);
  }
}

function calculateDraftStartTime(week: number): Date {
  // Find the Tuesday of the playoff week at 9am EST
  const now = new Date();
  const year = now.getFullYear();
  
  // NFL Week 17 is typically late December
  // For 2025 season: Week 17 starts around Dec 28
  // This is a simplified calculation - in production, derive from game schedule
  
  // For now, return next Tuesday at 9am EST (14:00 UTC)
  const tuesday = new Date();
  tuesday.setDate(tuesday.getDate() + ((2 - tuesday.getDay() + 7) % 7 || 7));
  tuesday.setUTCHours(14, 0, 0, 0); // 9am EST = 14:00 UTC
  
  return tuesday;
}

async function initializeWeek17(
  supabase: any, 
  leagueSeasonId: string, 
  rankedPlayers: { profileId: string; points: number; seed: number }[],
  draftStartTime: Date
) {
  const results: any = { rounds: [], participants: [] };

  // Create Semifinal round (top 4)
  const { data: semifinalRound, error: sfError } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 17,
      round_type: 'semifinal',
      status: 'pending',
      draft_start_time: draftStartTime.toISOString(),
    })
    .select()
    .single();

  if (sfError) {
    return NextResponse.json({ error: sfError.message }, { status: 500 });
  }
  results.rounds.push(semifinalRound);

  // Create Non-playoff round (5th+)
  const { data: nonPlayoffRound, error: npError } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 17,
      round_type: 'non_playoff',
      status: 'pending',
      draft_start_time: draftStartTime.toISOString(),
    })
    .select()
    .single();

  if (npError) {
    return NextResponse.json({ error: npError.message }, { status: 500 });
  }
  results.rounds.push(nonPlayoffRound);

  // Add participants
  for (const player of rankedPlayers) {
    const isPlayoff = player.seed <= 4;
    const roundId = isPlayoff ? semifinalRound.id : nonPlayoffRound.id;
    
    const { data: participant, error: pError } = await supabase
      .from('playoff_participants_v2')
      .insert({
        playoff_round_id: roundId,
        profile_id: player.profileId,
        seed: player.seed,
        picks_available: 4, // Everyone gets 4 picks
      })
      .select()
      .single();

    if (pError) {
      console.error('Error adding participant:', pError);
      continue;
    }
    results.participants.push(participant);
  }

  return NextResponse.json({ 
    message: 'Week 17 initialized',
    ...results 
  });
}

async function initializeWeek18(
  supabase: any, 
  leagueSeasonId: string,
  draftStartTime: Date
) {
  // Get Week 17 semifinal results
  const { data: week17Round } = await supabase
    .from('playoff_rounds_v2')
    .select('id')
    .eq('league_season_id', leagueSeasonId)
    .eq('week', 17)
    .eq('round_type', 'semifinal')
    .single();

  if (!week17Round) {
    return NextResponse.json({ error: 'Week 17 semifinal not found' }, { status: 400 });
  }

  // Get Week 17 participants with their points
  const { data: week17Participants } = await supabase
    .from('playoff_participants_v2')
    .select(`
      profile_id,
      seed
    `)
    .eq('playoff_round_id', week17Round.id);

  // Get Week 17 playoff picks points
  const { data: week17Picks } = await supabase
    .from('playoff_picks_v2')
    .select('profile_id, points')
    .eq('playoff_round_id', week17Round.id);

  // Calculate Week 17 totals
  const week17Points = new Map<string, number>();
  week17Picks?.forEach((pick: any) => {
    const current = week17Points.get(pick.profile_id) || 0;
    week17Points.set(pick.profile_id, current + (pick.points || 0));
  });

  // Rank Week 17 playoff participants
  const week17Ranked = week17Participants
    ?.map((p: any) => ({
      profileId: p.profile_id,
      points: week17Points.get(p.profile_id) || 0,
      regularSeasonSeed: p.seed,
    }))
    .sort((a: any, b: any) => b.points - a.points || a.regularSeasonSeed - b.regularSeasonSeed) || [];

  const results: any = { rounds: [], participants: [] };

  // Get SNF game for tiebreaker
  const { data: snfGame } = await supabase
    .from('games')
    .select('id')
    .eq('season', 2025)
    .eq('week', 18)
    .order('game_utc', { ascending: false })
    .limit(1)
    .single();

  // Create Championship round (top 2 from Week 17)
  const { data: champRound, error: cError } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 18,
      round_type: 'championship',
      status: 'pending',
      draft_start_time: draftStartTime.toISOString(),
      tiebreaker_game_id: snfGame?.id || null,
    })
    .select()
    .single();

  if (cError) {
    return NextResponse.json({ error: cError.message }, { status: 500 });
  }
  results.rounds.push(champRound);

  // Create Consolation round (3rd & 4th from Week 17)
  const { data: consolationRound, error: consError } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 18,
      round_type: 'consolation',
      status: 'pending',
      draft_start_time: draftStartTime.toISOString(),
    })
    .select()
    .single();

  if (consError) {
    return NextResponse.json({ error: consError.message }, { status: 500 });
  }
  results.rounds.push(consolationRound);

  // Create Non-playoff round (5th+)
  const { data: nonPlayoffRound, error: npError } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 18,
      round_type: 'non_playoff',
      status: 'pending',
      draft_start_time: draftStartTime.toISOString(),
    })
    .select()
    .single();

  if (npError) {
    return NextResponse.json({ error: npError.message }, { status: 500 });
  }
  results.rounds.push(nonPlayoffRound);

  // Add championship participants (top 2)
  for (let i = 0; i < Math.min(2, week17Ranked.length); i++) {
    const player = week17Ranked[i];
    await supabase
      .from('playoff_participants_v2')
      .insert({
        playoff_round_id: champRound.id,
        profile_id: player.profileId,
        seed: i + 1,
        picks_available: 4,
      });
  }

  // Add consolation participants (3rd & 4th)
  for (let i = 2; i < Math.min(4, week17Ranked.length); i++) {
    const player = week17Ranked[i];
    await supabase
      .from('playoff_participants_v2')
      .insert({
        playoff_round_id: consolationRound.id,
        profile_id: player.profileId,
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

  const playoffProfileIds = new Set(week17Ranked.slice(0, 4).map((p: any) => p.profileId));
  
  // Add non-playoff participants
  for (const p of allParticipants || []) {
    if (!playoffProfileIds.has(p.profile_id)) {
      await supabase
        .from('playoff_participants_v2')
        .insert({
          playoff_round_id: nonPlayoffRound.id,
          profile_id: p.profile_id,
          seed: null,
          picks_available: 4,
        });
    }
  }

  return NextResponse.json({ 
    message: 'Week 18 initialized',
    ...results 
  });
}
