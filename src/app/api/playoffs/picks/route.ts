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

  // For playoff rounds (semifinal/championship), check draft rules
  if (round.round_type === 'semifinal' || round.round_type === 'championship') {
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

      // If swapping an existing pick, check cooldown
      if (existingPick?.last_swap_at) {
        const lastSwap = new Date(existingPick.last_swap_at);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        if (lastSwap > hourAgo) {
          const waitMinutes = Math.ceil((lastSwap.getTime() + 3600000 - Date.now()) / 60000);
          return NextResponse.json({ 
            error: `You can swap again in ${waitMinutes} minutes` 
          }, { status: 400 });
        }
      }
    }

    // Check if THIS SPECIFIC TEAM is already picked by another playoff participant
    const { data: existingTeamPick } = await supabase
      .from('playoff_picks_v2')
      .select('id, profile_id')
      .eq('playoff_round_id', roundId)
      .eq('team_id', teamId)  // ✅ Check if THIS TEAM is taken
      .neq('profile_id', user.id)
      .maybeSingle();

    if (existingTeamPick) {
      return NextResponse.json({ error: 'This team has already been picked by another playoff participant' }, { status: 400 });
    }
  }

  // Check if user already has a pick at this position
  const { data: existingPositionPick } = await supabase
    .from('playoff_picks_v2')
    .select('id')
    .eq('playoff_round_id', roundId)
    .eq('profile_id', user.id)
    .eq('pick_position', pickPosition || 1)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existingPositionPick) {
    // Update existing pick
    const { data: updated, error: updateError } = await supabase
      .from('playoff_picks_v2')
      .update({
        game_id: gameId,
        team_id: teamId,
        picked_at: now,
        last_swap_at: now,
        updated_at: now,
      })
      .eq('id', existingPositionPick.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ pick: updated, action: 'updated' });
  } else {
    // Count existing picks
    const { count } = await supabase
      .from('playoff_picks_v2')
      .select('*', { count: 'exact', head: true })
      .eq('playoff_round_id', roundId)
      .eq('profile_id', user.id);

    if ((count || 0) >= participant.picks_available) {
      return NextResponse.json({ error: 'You have used all your picks' }, { status: 400 });
    }

    // Create new pick
    const { data: newPick, error: insertError } = await supabase
      .from('playoff_picks_v2')
      .insert({
        playoff_round_id: roundId,
        profile_id: user.id,
        game_id: gameId,
        team_id: teamId,
        pick_position: pickPosition || (count || 0) + 1,
        unlock_time: now,
        picked_at: now,
        last_swap_at: now,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ pick: newPick, action: 'created' });
  }
}

// DELETE /api/playoffs/picks?pickId=xxx
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
    .select('profile_id, game_id, playoff_round_id')
    .eq('id', pickId)
    .single();

  if (!pick || pick.profile_id !== user.id) {
    return NextResponse.json({ error: 'Pick not found or not yours' }, { status: 404 });
  }

  // Check if game started
  const { data: game } = await supabase
    .from('games')
    .select('game_utc')
    .eq('id', pick.game_id)
    .single();

  if (game && new Date(game.game_utc) <= new Date()) {
    return NextResponse.json({ error: 'Cannot delete - game has started' }, { status: 400 });
  }

  const { error } = await supabase
    .from('playoff_picks_v2')
    .delete()
    .eq('id', pickId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
