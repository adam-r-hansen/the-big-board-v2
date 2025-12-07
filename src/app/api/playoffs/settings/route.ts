import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/playoffs/settings?leagueSeasonId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const leagueSeasonId = searchParams.get('leagueSeasonId');

  if (!leagueSeasonId) {
    return NextResponse.json({ error: 'leagueSeasonId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('playoff_settings_v2')
    .select('*')
    .eq('league_season_id', leagueSeasonId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return default settings if none exist
  if (!data) {
    return NextResponse.json({
      league_season_id: leagueSeasonId,
      enabled: false,
      regular_season_weeks: 16,
    });
  }

  return NextResponse.json(data);
}

// POST /api/playoffs/settings - Create or update settings
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { leagueSeasonId, enabled, regularSeasonWeeks } = body;

  if (!leagueSeasonId) {
    return NextResponse.json({ error: 'leagueSeasonId required' }, { status: 400 });
  }

  // Upsert settings
  const { data, error } = await supabase
    .from('playoff_settings_v2')
    .upsert({
      league_season_id: leagueSeasonId,
      enabled: enabled ?? false,
      regular_season_weeks: regularSeasonWeeks ?? 16,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'league_season_id',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
