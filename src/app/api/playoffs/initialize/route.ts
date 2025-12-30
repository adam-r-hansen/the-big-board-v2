import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const adminClient = await createClient();

  const { data: { user } } = await adminClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { leagueSeasonId, week } = await request.json();

  if (!leagueSeasonId || !week) {
    return NextResponse.json(
      { error: 'leagueSeasonId and week required' },
      { status: 400 }
    );
  }

  // Get all participants for seeding purposes
  const { data: standings } = await adminClient
    .from('picks_v2')
    .select('profile_id, points')
    .eq('league_season_id', leagueSeasonId);

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
  // Get Week 17 semifinal round
  const { data: week17Round, error: week17RoundError } = await supabase
    .from('playoff_rounds_v2')
    .select('id')
    .eq('league_season_id', leagueSeasonId)
    .eq('week', 17)
    .eq('round_type', 'semifinal')
    .single();

  if (week17RoundError || !week17Round) {
    return NextResponse.json({ error: 'Week 17 semifinal not found' }, { status: 400 });
  }

  // Get Week 17 participants
  const { data: week17Participants, error: week17ParticipantsError } = await supabase
    .from('playoff_participants_v2')
    .select('profile_id, seed')
    .eq('playoff_round_id', week17Round.id);

  if (week17ParticipantsError || !week17Participants || week17Participants.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 Week 17 participants' }, { status: 400 });
  }

  // Get Week 17 picks and calculate points for each participant
  const { data: week17Picks, error: week17PicksError } = await supabase
    .from('playoff_picks_v2')
    .select('profile_id, points')
    .eq('playoff_round_id', week17Round.id);

  if (week17PicksError) {
    return NextResponse.json({ error: week17PicksError.message }, { status: 500 });
  }

  // Calculate total points for each participant
  const pointsMap = new Map<string, number>();
  week17Picks?.forEach((pick: any) => {
    const current = pointsMap.get(pick.profile_id) || 0;
    pointsMap.set(pick.profile_id, current + (pick.points || 0));
  });

  // Rank participants by Week 17 points (tiebreaker: regular season seed)
  const ranked = week17Participants
    .map((p: any) => ({
      profileId: p.profile_id,
      points: pointsMap.get(p.profile_id) || 0,
      regularSeasonSeed: p.seed,
    }))
    .sort((a: any, b: any) => 
      b.points - a.points || a.regularSeasonSeed - b.regularSeasonSeed
    );

  if (ranked.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 participants for Week 18' }, { status: 400 });
  }

  // Top 2 advance to championship
  const finalists = ranked.slice(0, 2);

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
  const { data: champRound, error: champError } = await supabase
    .from('playoff_rounds_v2')
    .insert({
      league_season_id: leagueSeasonId,
      week: 18,
      round_type: 'championship',
      status: 'pending',
      draft_start_time: draftStartTime.toISOString(),
      tiebreaker_game_id: snfGame?.id,
    })
    .select()
    .single();

  if (champError) {
    return NextResponse.json({ error: champError.message }, { status: 500 });
  }

  // Create Consolation round (3rd & 4th)
  const consolationParticipants = ranked.slice(2, 4);
  let consolationRound = null;

  if (consolationParticipants.length > 0) {
    const { data: consoleRound, error: consoleError } = await supabase
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

    if (consoleError) {
      return NextResponse.json({ error: consoleError.message }, { status: 500 });
    }

    consolationRound = consoleRound;

    // Add consolation participants
    for (let i = 0; i < consolationParticipants.length; i++) {
      await supabase.from('playoff_participants_v2').insert({
        playoff_round_id: consolationRound.id,
        profile_id: consolationParticipants[i].profileId,
        seed: i + 3, // Seeds 3 and 4
        picks_available: 4,
      });
    }
  }

  // Create Non-playoff round (everyone else)
  const { data: nonPlayoffRound, error: nonPlayoffError } = await supabase
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

  if (nonPlayoffError) {
    return NextResponse.json({ error: nonPlayoffError.message }, { status: 500 });
  }

  // Add championship participants (top 2)
  for (let i = 0; i < finalists.length; i++) {
    await supabase.from('playoff_participants_v2').insert({
      playoff_round_id: champRound.id,
      profile_id: finalists[i].profileId,
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

  // Add non-playoff participants (everyone not in top 4)
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

  return NextResponse.json({
    message: 'Week 18 initialized',
    championshipRound: champRound,
    consolationRound,
    nonPlayoffRound,
    finalists: finalists.map((f: any) => ({ profileId: f.profileId, points: f.points })),
  });
}
