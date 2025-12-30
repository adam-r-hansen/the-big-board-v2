import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateUnlockSchedule, isPickUnlocked, isDraftComplete } from '@/lib/playoffs/unlockSchedule';

// GET /api/playoffs/picks?roundId=xxx or ?leagueSeasonId=xxx&week=17
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const roundId = searchParams.get('roundId');
  const leagueSeasonId = searchParams.get('leagueSeasonId');
  const week = searchParams.get('week');

  let targetRoundId = roundId;

  // If no roundId, look up by league + week
  if (!targetRoundId && leagueSeasonId && week) {
    const { data: round } = await supabase
      .from('playoff_rounds_v2')
      .select('id')
      .eq('league_season_id', leagueSeasonId)
      .eq('week', parseInt(week))
      .in('round_type', ['semifinal', 'championship'])
      .single();
    
    targetRoundId = round?.id;
  }

  if (!targetRoundId) {
    return NextResponse.json({ error: 'roundId or leagueSeasonId+week required' }, { status: 400 });
  }

  // Get all picks for the round with team/game info
  const { data: picks, error } = await supabase
    .from('playoff_picks_v2')
    .select(`
      *,
      team:teams(id, name, short_name, abbreviation, color_primary, logo),
      game:games(id, week, home_team, away_team, home_score, away_score, game_utc, status)
    `)
    .eq('playoff_round_id', targetRoundId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ picks });
}

// POST /api/playoffs/picks - Make or update a pick
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { roundId, gameId, teamId, pickPosition } = body;

  if (!roundId || !gameId || !teamId) {
    return NextResponse.json({ error: 'roundId, gameId, teamId required' }, { status: 400 });
  }

  // Get round info
  const { data: round, error: roundError } = await supabase
    .from('playoff_rounds_v2')
    .select('*')
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    return NextResponse.json({ error: 'Round not found' }, { status: 404 });
  }

  const isOpenPicks = round.round_type === 'consolation' || round.round_type === 'non_playoff';

  // Get participant info (seed, picks_available)
  const { data: participant, error: pError } = await supabase
    .from('playoff_participants_v2')
    .select('*')
    .eq('playoff_round_id', roundId)
    .eq('profile_id', user.id)
    .single();

  if (pError || !participant) {
    return NextResponse.json({ error: 'You are not a participant in this round' }, { status: 403 });
  }

  // Check if game is locked (already started)
  const { data: game } = await supabase
    .from('games')
    .select('game_utc, status')
    .eq('id', gameId)
    .single();

  if (game && new Date(game.game_utc) <= new Date()) {
    return NextResponse.json({ error: 'Game has already started' }, { status: 400 });
  }

  // For championship/semifinal rounds, enforce draft rules and prevent duplicate teams
  if (!isOpenPicks) {
    const week = round.week as 17 | 18;
    const schedule = generateUnlockSchedule(
      week,
      new Date(round.draft_start_time),
      round.round_type as 'semifinal' | 'championship'
    );

    const draftComplete = isDraftComplete(schedule);

    if (!draftComplete) {
      // During draft: check if pick position is unlocked
      if (!pickPosition) {
        return NextResponse.json({ error: 'pickPosition required during draft' }, { status: 400 });
      }

      if (!isPickUnlocked(schedule, participant.seed, pickPosition)) {
        return NextResponse.json({ error: 'This pick position is not yet unlocked' }, { status: 400 });
      }
    } else {
      // After draft: enforce 1 swap per hour
      const { data: existingPick } = await supabase
        .from('playoff_picks_v2')
        .select('last_swap_at')
        .eq('playoff_round_id', roundId)
        .eq('profile_id', user.id)
        .eq('game_id', gameId)
        .single();

      // If swapping and last swap was less than 1 hour ago
      if (existingPick?.last_swap_at) {
        const lastSwap = new Date(existingPick.last_swap_at);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (lastSwap > hourAgo) {
          return NextResponse.json({ error: 'You can only swap once per hour' }, { status: 400 });
        }
      }
    }

    // Check if team is already taken by someone else in this round (championship/semifinal only)
    const { data: teamTaken } = await supabase
      .from('playoff_picks_v2')
      .select('id, profile_id')
      .eq('playoff_round_id', roundId)
      .eq('team_id', teamId)
      .neq('profile_id', user.id)
      .single();

    if (teamTaken) {
      return NextResponse.json({ error: 'Team already picked by another player' }, { status: 400 });
    }
  }

  // Check if pick already exists for this game
  const { data: existingPick } = await supabase
    .from('playoff_picks_v2')
    .select('id')
    .eq('playoff_round_id', roundId)
    .eq('profile_id', user.id)
    .eq('game_id', gameId)
    .single();

  if (existingPick) {
    // Update existing pick
    const { error: updateError } = await supabase
      .from('playoff_picks_v2')
      .update({
        team_id: teamId,
        last_swap_at: new Date().toISOString(),
      })
      .eq('id', existingPick.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Pick updated' });
  }

  // Create new pick
  const actualPickPosition = pickPosition || (await getNextPickPosition(supabase, roundId, user.id));

  const { error: insertError } = await supabase
    .from('playoff_picks_v2')
    .insert({
      playoff_round_id: roundId,
      profile_id: user.id,
      game_id: gameId,
      team_id: teamId,
      pick_position: actualPickPosition,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Pick created' });
}

// DELETE /api/playoffs/picks - Remove a pick (unpick)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pickId = searchParams.get('pickId');

  if (!pickId) {
    return NextResponse.json({ error: 'pickId required' }, { status: 400 });
  }

  // Verify ownership
  const { data: pick } = await supabase
    .from('playoff_picks_v2')
    .select('*, game:games(game_utc)')
    .eq('id', pickId)
    .eq('profile_id', user.id)
    .single();

  if (!pick) {
    return NextResponse.json({ error: 'Pick not found or not owned by you' }, { status: 404 });
  }

  // Check if game is locked
  const game = Array.isArray(pick.game) ? pick.game[0] : pick.game;
  if (game && new Date(game.game_utc) <= new Date()) {
    return NextResponse.json({ error: 'Cannot remove pick after game starts' }, { status: 400 });
  }

  const { error } = await supabase
    .from('playoff_picks_v2')
    .delete()
    .eq('id', pickId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Pick removed' });
}

async function getNextPickPosition(supabase: any, roundId: string, profileId: string): Promise<number> {
  const { data: picks } = await supabase
    .from('playoff_picks_v2')
    .select('pick_position')
    .eq('playoff_round_id', roundId)
    .eq('profile_id', profileId)
    .order('pick_position', { ascending: false })
    .limit(1);

  if (!picks || picks.length === 0) return 1;
  return picks[0].pick_position + 1;
}
