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

    // Step 1: Get all teams with their current records
    const { data: teams, error: teamsErr } = await sb
      .from('teams')
      .select('id, abbreviation, wins, losses, ties')

    if (teamsErr) return json({ error: teamsErr.message }, 500)

    // Step 2: Calculate OOF teams (win % < .400)
    const oofTeams: string[] = []
    for (const team of teams || []) {
      const wins = team.wins || 0
      const losses = team.losses || 0
      const ties = team.ties || 0
      const totalGames = wins + losses + ties
      
      if (totalGames === 0) continue // Skip teams with no games
      
      const winPct = wins / totalGames
      if (winPct < 0.400) {
        oofTeams.push(team.id)
      }
    }

    if (oofTeams.length === 0) {
      return json({ error: 'No OOF teams found (win % < .400)' }, 400)
    }

    // Step 3: Find all Week games where OOF teams are playing
    const { data: games, error: gamesErr } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team')
      .eq('season', season)
      .eq('week', week)
      .or(`home_team.in.(${oofTeams.join(',')}),away_team.in.(${oofTeams.join(',')})`)

    if (gamesErr) return json({ error: gamesErr.message }, 500)

    if (!games || games.length === 0) {
      return json({ error: 'No games found for OOF teams in this week' }, 400)
    }

    // Step 4: Hydrate wrinkle with all OOF games
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

    // Get team details for response
    const oofTeamDetails = (teams || [])
      .filter(t => oofTeams.includes(t.id))
      .map(t => ({
        id: t.id,
        abbreviation: t.abbreviation,
        record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}`,
        winPct: ((t.wins || 0) / ((t.wins || 0) + (t.losses || 0) + (t.ties || 0))).toFixed(3)
      }))

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
