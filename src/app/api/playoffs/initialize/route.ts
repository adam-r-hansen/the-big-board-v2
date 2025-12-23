import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/playoffs/initialize - Initialize a playoff round
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is Adam (admin check)
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  if (profile?.display_name !== 'Adam!') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { leagueSeasonId, week } = body;

  if (!leagueSeasonId || !week) {
    return NextResponse.json({ error: 'leagueSeasonId and week required' }, { status: 400 });
  }

  if (week !== 17 && week !== 18) {
    return NextResponse.json({ error: 'week must be 17 or 18' }, { status: 400 });
  }

  // Use admin client for database operations that bypass RLS
  const adminClient = createAdminClient();

  // Check if round already exists
  const { data: existingRound } = await adminClient
    .from('playoff_rounds_v2')
    .select('id')
    .eq('league_season_id', leagueSeasonId)
    .eq('week', week)
    .single();

  if (existingRound) {
    return NextResponse.json({ error: 'Round already initialized' }, { status: 400 });
  }

  // Get standings from regular season (weeks 1-16) or Week 17
  const { data: standings, error: standingsError } = await adminClient
    .from('picks_v2')
    .select('profile_id, points')
    .eq('league_season_id', leagueSeasonId);

  if (standingsError) {
    return NextResponse.json({ error: standingsError.message }, { status: 500 });
  }

  // Calculate total points per player
  const pointsMap = new Map<string, number>();
  standings?.forEach((pick: any) => {
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
    return await initializeWeek17(adminClient, leagueSeasonId, rankedPlayers, draftStartTime);
  } else {
    // Week 18: Need Week 17 results
    return await initializeWeek18(adminClient, leagueSeasonId, draftStartTime);
  }
}

function calculateDraftStartTime(week: number): Date {
  // Find the Tuesday of the playoff week at 9am EST
  const now = new Date();
  
  // For now, return next Tuesday at 9am EST (14:00 UTC)
  const tuesday = new Date();
  const daysUntilTuesday = (2 - tuesday.getDay() + 7) % 7 || 7;
  tuesday.setDate(tuesday.getDate() + daysUntilTuesday);
  tuesday.setHours(14, 0, 0, 0); // 9am EST = 14:00 UTC
  
  return tuesday;
}

async function initializeWeek17(
  supabase: any,
  leagueSeasonId: string,
  rankedPlayers: Array<{ profileId: string; points: number; seed: number }>,
  draftStartTime: Date
) {
  // Create Semifinal round
  const { data: semifinalRound, error: semifinalError } = await supabase
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

  if (semifinalError) {
    return NextResponse.json({ error: semifinalError.message }, { status: 500 });
  }

  // Create Non-playoff round
  const { data: nonPlayoffRound, error: nonPlayoffError } = await supabase
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

  if (nonPlayoffError) {
    return NextResponse.json({ error: nonPlayoffError.message }, { status: 500 });
  }

  // Add participants
  const participants = rankedPlayers.map(player => ({
    playoff_round_id: player.seed <= 4 ? semifinalRound.id : nonPlayoffRound.id,
    profile_id: player.profileId,
    seed: player.seed,
    picks_available: 4,
  }));

  const { error: participantsError } = await supabase
    .from('playoff_participants_v2')
    .insert(participants);

  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Week 17 initialized',
    semifinalRound,
    nonPlayoffRound,
    participantCount: participants.length,
  });
}

async function initializeWeek18(
  supabase: any,
  leagueSeasonId: string,
  draftStartTime: Date
) {
  // Get Week 17 semifinal participants with their scores
  const { data: week17Participants, error: week17Error } = await supabase
    .from('playoff_participants_v2')
    .select(`
      *,
      round:playoff_rounds_v2!inner(week, round_type, league_season_id)
    `)
    .eq('round.league_season_id', leagueSeasonId)
    .eq('round.week', 17)
    .eq('round.round_type', 'semifinal')
    .order('playoff_points', { ascending: false });

  if (week17Error) {
    return NextResponse.json({ error: week17Error.message }, { status: 500 });
  }

  if (!week17Participants || week17Participants.length < 2) {
    return NextResponse.json({ error: 'Need Week 17 results' }, { status: 400 });
  }

  // Top 2 from Week 17 advance to championship
  const finalists = week17Participants
    .slice(0, 2)
    .map((p: any, idx: number) => ({ ...p, championshipSeed: idx + 1 }));

  // Create Championship round
  const { data: championshipRound, error: championshipError } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 18,
      round_type: 'championship',
      status: 'pending',
      draft_start_time: draftStartTime.toISOString(),
    })
    .select()
    .single();

  if (championshipError) {
    return NextResponse.json({ error: championshipError.message }, { status: 500 });
  }

  // Add championship participants
  const participants = finalists.map((finalist: any) => ({
    playoff_round_id: championshipRound.id,
    profile_id: finalist.profile_id,
    seed: finalist.championshipSeed,
    picks_available: 4,
  }));

  const { error: participantsError } = await supabase
    .from('playoff_participants_v2')
    .insert(participants);

  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Week 18 initialized',
    championshipRound,
    finalists: finalists.map((f: any) => ({ profileId: f.profile_id, seed: f.championshipSeed })),
  });
}
