import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { leagueSeasonId, week } = await request.json();
    
    if (!leagueSeasonId || !week) {
      return NextResponse.json({ error: 'Missing leagueSeasonId or week' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get all active participants in the league
    const { data: participants } = await supabase
      .from('league_season_participants_v2')
      .select('profile_id')
      .eq('league_season_id', leagueSeasonId)
      .eq('active', true);

    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: 'No participants found' }, { status: 404 });
    }

    // Get all picks for this week
    const { data: existingPicks } = await supabase
      .from('picks_v2')
      .select('profile_id, team_id')
      .eq('league_season_id', leagueSeasonId)
      .eq('week', week);

    // Get all picks for the season (to track used teams)
    const { data: seasonPicks } = await supabase
      .from('picks_v2')
      .select('profile_id, team_id')
      .eq('league_season_id', leagueSeasonId);

    // Get games for this week (need completed games)
    const { data: weekGames } = await supabase
      .from('games')
      .select('id, home_team, away_team, home_score, away_score, status')
      .eq('season', 2025)
      .eq('week', week)
      .eq('status', 'FINAL');

    if (!weekGames || weekGames.length === 0) {
      return NextResponse.json({ error: 'No completed games for this week' }, { status: 400 });
    }

    // Build map of used teams per user
    const usedTeamsMap = new Map<string, Set<string>>();
    for (const pick of seasonPicks || []) {
      if (!usedTeamsMap.has(pick.profile_id)) {
        usedTeamsMap.set(pick.profile_id, new Set());
      }
      usedTeamsMap.get(pick.profile_id)!.add(pick.team_id);
    }

    // Build map of week picks per user
    const weekPicksMap = new Map<string, number>();
    for (const pick of existingPicks || []) {
      weekPicksMap.set(pick.profile_id, (weekPicksMap.get(pick.profile_id) || 0) + 1);
    }

    // Find losing teams and low-scoring winners
    const losingTeams: { teamId: string; gameId: string; score: number }[] = [];
    const winningTeams: { teamId: string; gameId: string; score: number }[] = [];

    for (const game of weekGames) {
      const homeScore = game.home_score ?? 0;
      const awayScore = game.away_score ?? 0;

      if (homeScore > awayScore) {
        winningTeams.push({ teamId: game.home_team, gameId: game.id, score: homeScore });
        losingTeams.push({ teamId: game.away_team, gameId: game.id, score: awayScore });
      } else if (awayScore > homeScore) {
        winningTeams.push({ teamId: game.away_team, gameId: game.id, score: awayScore });
        losingTeams.push({ teamId: game.home_team, gameId: game.id, score: homeScore });
      } else {
        // Tie - both go to losers pool
        losingTeams.push({ teamId: game.home_team, gameId: game.id, score: homeScore });
        losingTeams.push({ teamId: game.away_team, gameId: game.id, score: awayScore });
      }
    }

    // Sort winners by score (ascending) for low-scoring winners
    winningTeams.sort((a, b) => a.score - b.score);

    const autoAssignedPicks: any[] = [];
    const notifications: any[] = [];

    // Process each participant
    for (const participant of participants) {
      const profileId = participant.profile_id;
      const currentPickCount = weekPicksMap.get(profileId) || 0;
      const usedTeams = usedTeamsMap.get(profileId) || new Set();
      
      let picksNeeded = 2 - currentPickCount;

      while (picksNeeded > 0) {
        // 95% chance: pick from losers, 5% chance: pick from low-scoring winners
        const useLoser = Math.random() < 0.95;
        const pool = useLoser ? losingTeams : winningTeams;

        // Find available team
        let assigned = false;
        for (const team of pool) {
          if (!usedTeams.has(team.teamId)) {
            // Assign this team
            autoAssignedPicks.push({
              league_season_id: leagueSeasonId,
              profile_id: profileId,
              week: week,
              team_id: team.teamId,
              game_id: team.gameId,
              points: 0, // Loss = 0 points
              auto_assigned: true,
              locked_at: new Date().toISOString(),
            });

            // Get team name for notification
            const { data: teamData } = await supabase
              .from('teams')
              .select('short_name')
              .eq('id', team.teamId)
              .single();

            notifications.push({
              profile_id: profileId,
              type: 'auto_assign',
              priority: 'normal',
              message: `${teamData?.short_name || 'A team'} were auto assigned for week ${week}`,
              read: false,
              expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days
            });

            usedTeams.add(team.teamId);
            assigned = true;
            picksNeeded--;
            break;
          }
        }

        // If no team found in primary pool, try the other pool
        if (!assigned) {
          const fallbackPool = useLoser ? winningTeams : losingTeams;
          for (const team of fallbackPool) {
            if (!usedTeams.has(team.teamId)) {
              autoAssignedPicks.push({
                league_season_id: leagueSeasonId,
                profile_id: profileId,
                week: week,
                team_id: team.teamId,
                game_id: team.gameId,
                points: 0,
                auto_assigned: true,
                locked_at: new Date().toISOString(),
              });

              const { data: teamData } = await supabase
                .from('teams')
                .select('short_name')
                .eq('id', team.teamId)
                .single();

              notifications.push({
                profile_id: profileId,
                type: 'auto_assign',
                priority: 'normal',
                message: `${teamData?.short_name || 'A team'} were auto assigned for week ${week}`,
                read: false,
                expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
              });

              usedTeams.add(team.teamId);
              picksNeeded--;
              break;
            }
          }
        }

        // Safety: if still can't assign, break to avoid infinite loop
        if (!assigned && picksNeeded === 2 - currentPickCount) {
          console.error(`Could not auto-assign for profile ${profileId}`);
          break;
        }
      }
    }

    // Insert auto-assigned picks
    if (autoAssignedPicks.length > 0) {
      const { error: picksError } = await supabase
        .from('picks_v2')
        .insert(autoAssignedPicks);

      if (picksError) {
        console.error('Error inserting picks:', picksError);
        return NextResponse.json({ error: picksError.message }, { status: 500 });
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications_v2')
        .insert(notifications);

      if (notifError) {
        console.error('Error inserting notifications:', notifError);
      }
    }

    return NextResponse.json({
      success: true,
      assigned: autoAssignedPicks.length,
      message: `Auto-assigned ${autoAssignedPicks.length} picks for ${participants.length} participants`,
    });

  } catch (error: any) {
    console.error('Auto-assign error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
