// app/api/admin/wrinkles/[id]/hydrate-oof/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const revalidate = 0

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      pragma: 'no-cache',
    },
  })
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: wrinkleId } = await context.params
    if (!wrinkleId) return json({ error: 'missing wrinkle id' }, 400)

    const sb = createAdminClient()

    // Get the wrinkle to find season and week
    const { data: wrinkle, error: wErr } = await sb
      .from('wrinkles_v2')
      .select('league_season_id, week, league_seasons_v2(season)')
      .eq('id', wrinkleId)
      .single()

    if (wErr) return json({ error: wErr.message }, 500)
    
    const week = wrinkle.week
    const season = (wrinkle.league_seasons_v2 as any)?.season

    if (!week || !season) {
      return json({ error: 'Could not determine season/week from wrinkle' }, 400)
    }

    // Get all teams
    const { data: teams, error: teamsErr } = await sb
      .from('teams')
      .select('id, abbreviation')

    if (teamsErr) return json({ error: teamsErr.message }, 500)

    // Get all FINAL games for this season before the wrinkle week
    const { data: completedGames, error: gamesErr } = await sb
      .from('games')
      .select('id, home_team, away_team, home_score, away_score, status')
      .eq('season', season)
      .eq('status', 'FINAL')
      .lt('week', week)

    if (gamesErr) return json({ error: gamesErr.message }, 500)

    // Calculate each team's record
    const teamRecords = new Map<string, { wins: number; losses: number; ties: number }>();
    
    for (const team of teams || []) {
      teamRecords.set(team.id, { wins: 0, losses: 0, ties: 0 });
    }

    for (const game of completedGames || []) {
      const homeScore = game.home_score || 0;
      const awayScore = game.away_score || 0;
      
      const homeRecord = teamRecords.get(game.home_team);
      const awayRecord = teamRecords.get(game.away_team);
      
      if (!homeRecord || !awayRecord) continue;

      if (homeScore > awayScore) {
        homeRecord.wins++;
        awayRecord.losses++;
      } else if (awayScore > homeScore) {
        awayRecord.wins++;
        homeRecord.losses++;
      } else {
        homeRecord.ties++;
        awayRecord.ties++;
      }
    }

    // Find OOF teams (win % < .400)
    const oofTeams: string[] = [];
    const oofTeamDetails: any[] = [];

    for (const team of teams || []) {
      const record = teamRecords.get(team.id);
      if (!record) continue;

      const totalGames = record.wins + record.losses + record.ties;
      if (totalGames === 0) continue;

      const winPct = record.wins / totalGames;
      
      if (winPct < 0.400) {
        oofTeams.push(team.id);
        oofTeamDetails.push({
          id: team.id,
          abbreviation: team.abbreviation,
          record: `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`,
          winPct: winPct.toFixed(3)
        });
      }
    }

    if (oofTeams.length === 0) {
      return json({ error: 'No OOF teams found (win % < .400)' }, 400)
    }

    // Find all Week games where OOF teams are playing
    const { data: games, error: weekGamesErr } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team')
      .eq('season', season)
      .eq('week', week)
      .or(`home_team.in.(${oofTeams.join(',')}),away_team.in.(${oofTeams.join(',')})`)

    if (weekGamesErr) return json({ error: weekGamesErr.message }, 500)

    if (!games || games.length === 0) {
      return json({ error: 'No games found for OOF teams in this week' }, 400)
    }

    // Hydrate wrinkle with all OOF games
    const rows = games.map(g => ({
      wrinkle_id: wrinkleId,
      game_id: g.id,
    }))

    const { data: upserted, error: uErr } = await sb
      .from('wrinkle_games_v2')
      .upsert(rows, { onConflict: 'wrinkle_id,game_id' })
      .select('id')

    if (uErr) {
      return json({ error: uErr.message, hint: 'upsert failed' }, 500)
    }

    return json({
      ok: true,
      season,
      week,
      oofTeams: oofTeamDetails,
      gamesHydrated: upserted?.length || 0,
    })
  } catch (e: any) {
    return json({ error: e?.message ?? 'server error' }, 500)
  }
}
