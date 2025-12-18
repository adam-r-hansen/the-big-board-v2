import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const revalidate = 0;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }

    const season = body?.season ?? 2025;
    const weeksInput = body?.weeks ?? 'all';
    
    let weeks: number[] = [];
    if (weeksInput === 'all') {
      weeks = Array.from({ length: 18 }, (_, i) => i + 1);
    } else {
      const parts = String(weeksInput).split(',').map(p => p.trim());
      for (const p of parts) {
        if (p.includes('-')) {
          const [start, end] = p.split('-').map(Number);
          for (let w = start; w <= end; w++) weeks.push(w);
        } else {
          weeks.push(Number(p));
        }
      }
    }

    let updated = 0;
    let errors: string[] = [];

    for (const week of weeks) {
      try {
        // Fetch from ESPN scoreboard
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`;
        const res = await fetch(url, { 
          cache: 'no-store', 
          headers: { 'User-Agent': 'the-big-board/2.0' } 
        });
        
        if (!res.ok) {
          errors.push(`Week ${week}: ESPN API returned ${res.status}`);
          continue;
        }

        const data = await res.json();
        const events = data?.events ?? [];

        for (const event of events) {
          const comp = event?.competitions?.[0];
          if (!comp) continue;

          const competitors = comp.competitors ?? [];
          const homeComp = competitors.find((c: any) => c?.homeAway === 'home');
          const awayComp = competitors.find((c: any) => c?.homeAway === 'away');
          
          if (!homeComp || !awayComp) continue;

          const homeAbbr = homeComp.team?.abbreviation;
          const awayAbbr = awayComp.team?.abbreviation;
          const homeScore = parseInt(homeComp.score) || null;
          const awayScore = parseInt(awayComp.score) || null;
          const espnStatus = comp.status?.type?.name;
          
          // Map ESPN status to our status
          let status = 'UPCOMING';
          if (espnStatus === 'STATUS_FINAL') {
            status = 'FINAL';
          } else if (espnStatus === 'STATUS_IN_PROGRESS') {
            status = 'IN_PROGRESS';
          }

          // Get team IDs from our database
          const { data: homeTeam } = await admin
            .from('teams')
            .select('id')
            .eq('abbreviation', homeAbbr)
            .single();
            
          const { data: awayTeam } = await admin
            .from('teams')
            .select('id')
            .eq('abbreviation', awayAbbr)
            .single();

          if (!homeTeam || !awayTeam) continue;

          // Update the game
          const { error: updateError } = await admin
            .from('games')
            .update({
              home_score: homeScore,
              away_score: awayScore,
              status: status,
            })
            .eq('season', season)
            .eq('week', week)
            .eq('home_team', homeTeam.id)
            .eq('away_team', awayTeam.id);

          if (updateError) {
            errors.push(`${homeAbbr} vs ${awayAbbr}: ${updateError.message}`);
          } else {
            updated++;
          }
        }
      } catch (e: any) {
        errors.push(`Week ${week}: ${e.message}`);
      }
    }

    return json({
      ok: true,
      season,
      weeks,
      updated,
      errors,
    });
  } catch (e: any) {
    console.error('Game update error:', e);
    return json({ error: e?.message || 'Internal server error' }, 500);
  }
}
