import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createClient();

    // Get all active league seasons
    const { data: leagueSeasons, error: lsError } = await supabase
      .from('league_seasons_v2')
      .select('id')
      .eq('season', 2025);

    if (lsError) {
      console.error('Error fetching league seasons:', lsError);
      return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
    }

    if (!leagueSeasons || leagueSeasons.length === 0) {
      return NextResponse.json({ message: 'No active leagues found' });
    }

    // Calculate standings for each league
    const results = [];
    for (const ls of leagueSeasons) {
      const { error: calcError } = await supabase.rpc('calculate_standings_v2', {
        p_league_season_id: ls.id
      });

      if (calcError) {
        console.error(`Error calculating standings for league ${ls.id}:`, calcError);
        results.push({ league_id: ls.id, success: false, error: calcError.message });
      } else {
        results.push({ league_id: ls.id, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Updated standings for ${successCount}/${leagueSeasons.length} leagues`,
      results
    });

  } catch (error) {
    console.error('Standings update error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
