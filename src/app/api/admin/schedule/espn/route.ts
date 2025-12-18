import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const revalidate = 0

type Item = { week: number; kickoff: string; home: string; away: string }

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function fetchScoreboard(season: number, week: number): Promise<Item[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'the-big-board/2.0' } })
  if (!res.ok) throw new Error(`scoreboard ${res.status}`)
  const data: any = await res.json()
  const events: any[] = data?.events ?? []
  const out: Item[] = []
  for (const ev of events) {
    const comp = ev?.competitions?.[0]
    const date = comp?.date || ev?.date
    const comps: any[] = comp?.competitors ?? []
    const homeC = comps.find(c => c?.homeAway === 'home')
    const awayC = comps.find(c => c?.homeAway === 'away')
    const home = homeC?.team?.abbreviation || homeC?.team?.displayName
    const away = awayC?.team?.abbreviation || awayC?.team?.displayName
    if (!date || !home || !away) continue
    
    // FIXED: Convert to UTC properly to avoid timezone issues
    const gameDate = new Date(date)
    out.push({ week, kickoff: gameDate.toISOString(), home, away })
  }
  return out
}

function normalizeKey(s: string): string {
  const raw = s.trim().toUpperCase()
  const map: Record<string, string> = {
    WSH: 'WAS', JAX: 'JAC', ARZ: 'ARI', NOR: 'NO', NWE: 'NE', TBB: 'TB',
    KAN: 'KC', GNB: 'GB', SFO: 'SF', OAK: 'LV', LVR: 'LV', SD: 'LAC', LA: 'LAR'
  }
  return map[raw] || raw
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient()
  
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const season = body?.season ?? new Date().getFullYear()
  const weeksInput = body?.weeks ?? 'all'
  
  let weeks: number[] = []
  if (weeksInput === 'all') {
    weeks = Array.from({ length: 18 }, (_, i) => i + 1)
  } else {
    const parts = String(weeksInput).split(',').map(p => p.trim())
    for (const p of parts) {
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(Number)
        for (let w = start; w <= end; w++) weeks.push(w)
      } else {
        weeks.push(Number(p))
      }
    }
  }

  // Get teams for ID mapping
  const { data: teams } = await admin.from('teams').select('id, abbreviation, name')
  const index = new Map<string, string>()
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')
  
  for (const t of teams ?? []) {
    index.set(norm(t.abbreviation), t.id)
    index.set(norm(t.name), t.id)
    index.set(norm(normalizeKey(t.abbreviation)), t.id)
  }
  
  const findTeamId = (key: string) => index.get(norm(normalizeKey(key))) || index.get(norm(key)) || null

  const allItems: Item[] = []
  const fetchErrors: Array<{ week: number; error: string }> = []
  
  for (const w of weeks) {
    try {
      const items = await fetchScoreboard(season, w)
      allItems.push(...items)
    } catch (e: any) {
      fetchErrors.push({ week: Number(w), error: e?.message || 'fetch failed' })
    }
  }

  const rows: Array<{
    season: number
    week: number
    home_team: string
    away_team: string
    game_utc: string
    status: string
  }> = []
  const unknown: Item[] = []
  
  for (const it of allItems) {
    const homeId = findTeamId(it.home)
    const awayId = findTeamId(it.away)
    if (!homeId || !awayId) {
      unknown.push(it)
      continue
    }
    rows.push({
      season,
      week: it.week,
      home_team: homeId,
      away_team: awayId,
      game_utc: it.kickoff,
      status: 'UPCOMING',
    })
  }

  let upsertError: string | null = null
  if (rows.length) {
    const { error } = await admin
      .from('games')
      .upsert(rows, { onConflict: 'season,week,home_team,away_team', ignoreDuplicates: false })
    if (error) upsertError = error.message
  }

  return json(
    {
      ok: !upsertError,
      season,
      weeks,
      counts: {
        fetched: allItems.length,
        touched: rows.length,
        unknownTeams: unknown.length,
      },
      fetchErrors,
      unknown,
      upsertError,
    },
    { status: upsertError ? 500 : 200 }
  )
}
