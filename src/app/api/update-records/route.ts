import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

async function fetchTeamRecords() {
  // Use scoreboard endpoint which includes team records
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`;
  const res = await fetch(url, { 
    cache: 'no-store',
    headers: { 'User-Agent': 'the-big-board/2.0' }
  });
  
  if (!res.ok) {
    throw new Error(`ESPN scoreboard fetch failed: ${res.status}`);
  }
  
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const debug = url.searchParams.get('debug') === 'true';

    // Fetch from ESPN scoreboard (has all teams with records)
    const data = await fetchTeamRecords();
    
    if (debug) {
      const sampleEvent = data.events?.[0];
      const sampleCompetitor = sampleEvent?.competitions?.[0]?.competitors?.[0];
      return NextResponse.json({
        debug: true,
        sample_competitor: sampleCompetitor,
        events_count: data.events?.length,
      }, { status: 200 });
    }
    
    // Parse team records from all games
    const recordsMap = new Map<string, { wins: number; losses: number; ties: number }>();
    
    for (const event of data.events || []) {
      for (const competition of event.competitions || []) {
        for (const competitor of competition.competitors || []) {
          const team = competitor.team;
          const abbr = team?.abbreviation;
          
          if (!abbr || recordsMap.has(abbr)) continue; // Skip duplicates
          
          // Records are in competitor.records array
          const records = competitor.records || [];
          const overallRecord = records.find((r: any) => r.type === 'total' || r.name === 'overall');
          
          if (overallRecord?.summary) {
            // Summary format: "11-2" or "6-6-1"
            const parts = overallRecord.summary.split('-').map(Number);
            recordsMap.set(abbr, {
              wins: parts[0] || 0,
              losses: parts[1] || 0,
              ties: parts[2] || 0,
            });
          }
        }
      }
    }

    const updates = Array.from(recordsMap.entries()).map(([abbreviation, record]) => ({
      abbreviation,
      ...record,
    }));

    if (updates.length === 0) {
      return NextResponse.json({ 
        error: 'No team records found',
        events_count: data.events?.length,
      }, { status: 500 });
    }

    // Update each team in the database
    let updated = 0;
    let errors: string[] = [];
    
    for (const record of updates) {
      const { error } = await supabase
        .from('teams')
        .update({
          wins: record.wins,
          losses: record.losses,
          ties: record.ties,
        })
        .eq('abbreviation', record.abbreviation);
      
      if (error) {
        errors.push(`${record.abbreviation}: ${error.message}`);
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      total: updates.length,
      errors: errors.length > 0 ? errors : undefined,
      records: updates,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update records' },
      { status: 500 }
    );
  }
}

// GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
