import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/scoring - Score all picks for completed games
export async function POST(request: NextRequest) {
  // Use service client to bypass RLS
  const supabase = await createServiceClient();

  const results = {
    updated: 0,
    errors: [] as string[],
  };

  // Get all picks that need scoring (points is 0 or null, game is FINAL)
  const { data: picks, error: picksError } = await supabase
    .from('picks_v2')
    .select(`
      id,
      team_id,
      points,
      game:games!inner(
        id,
        status,
        home_team,
        away_team,
        home_score,
        away_score
      )
    `)
    .or('points.is.null,points.eq.0');

  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 500 });
  }

  for (const pick of picks || []) {
    const game = pick.game as any;
    
    // Only score FINAL games
    if (game.status !== 'FINAL') continue;

    // Determine if picked team won
    const isHome = pick.team_id === game.home_team;
    const teamScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;

    if (teamScore === null || oppScore === null) continue;

    const won = teamScore > oppScore;
    const points = won ? teamScore : 0;

    // Update the pick
    const { error: updateError } = await supabase
      .from('picks_v2')
      .update({ points })
      .eq('id', pick.id);

    if (updateError) {
      results.errors.push(`Pick ${pick.id}: ${updateError.message}`);
    } else {
      results.updated++;
    }
  }

  return NextResponse.json({
    message: 'Scoring complete',
    ...results,
  });
}

// GET /api/scoring - Check scoring status
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient();

  // Count picks needing scoring
  const { count: needsScoring } = await supabase
    .from('picks_v2')
    .select('id, game:games!inner(status)', { count: 'exact', head: true })
    .or('points.is.null,points.eq.0')
    .eq('game.status', 'FINAL');

  // Count scored picks
  const { count: scored } = await supabase
    .from('picks_v2')
    .select('*', { count: 'exact', head: true })
    .gt('points', 0);

  return NextResponse.json({
    needsScoring: needsScoring || 0,
    scored: scored || 0,
  });
}
