import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  // Get all games for this wrinkle from wrinkle_games_v2
  const { data: wrinkleGames, error } = await supabase
    .from('wrinkle_games_v2')
    .select(`
      game_id,
      games (
        id,
        week,
        game_utc,
        status,
        home_team,
        away_team,
        home_score,
        away_score,
        home:teams!games_home_team_fkey(id, short_name, abbreviation, logo, color_primary),
        away:teams!games_away_team_fkey(id, short_name, abbreviation, logo, color_primary)
      )
    `)
    .eq('wrinkle_id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Transform to Game[] format
  const games = (wrinkleGames || []).map((wg: any) => ({
    id: wg.games.id,
    week: wg.games.week,
    game_utc: wg.games.game_utc,
    status: wg.games.status,
    home_team: wg.games.home_team,
    away_team: wg.games.away_team,
    home_score: wg.games.home_score,
    away_score: wg.games.away_score,
    home: wg.games.home,
    away: wg.games.away,
  }));

  return Response.json({ games });
}
