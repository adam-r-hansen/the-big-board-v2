'use client';

import { Box, Paper, Typography, Stack, Chip } from '@mui/material';
import { EmojiEvents, Lock, CheckCircle } from '@mui/icons-material';

type Team = {
  id: string;
  name: string;
  short_name: string;
  abbreviation: string;
  color_primary: string;
  logo: string;
};

type Game = {
  id: string;
  game_utc: string;
  status: string;
};

type PlayoffPick = {
  id: string;
  profile_id: string;
  team_id: string;
  pick_position: number;
  game_id: string;
  points: number;
  team?: Team;
  game?: Game;
};

type PlayoffParticipant = {
  id: string;
  profile_id: string;
  seed: number;
  picks_available: number;
  profile?: {
    display_name: string;
    email: string;
  };
};

interface Props {
  participants: PlayoffParticipant[];
  picks: PlayoffPick[];
  currentUserId: string | null;
  week: number;
  roundType: 'semifinal' | 'championship' | 'consolation';
}

export default function PlayoffBracket({ participants, picks, currentUserId, week, roundType }: Props) {
  const now = new Date();

  // Calculate points for each participant
  const participantStats = participants.map(participant => {
    const participantPicks = picks.filter(p => p.profile_id === participant.profile_id);
    const weekPoints = participantPicks.reduce((sum, p) => sum + (p.points || 0), 0);
    
    return {
      ...participant,
      weekPoints,
      picks: participantPicks,
    };
  });

  // Sort by points descending
  const sortedParticipants = [...participantStats].sort((a, b) => b.weekPoints - a.weekPoints);

  const isGameLocked = (pick: PlayoffPick): boolean => {
    if (!pick.game?.game_utc) return false;
    return new Date(pick.game.game_utc) <= now;
  };

  const getRankStyle = (index: number) => {
    if (roundType === 'consolation') {
      // Bronze for consolation winner
      if (index === 0) {
        return {
          borderColor: '#cd7f32',
          boxShadow: '0 4px 20px rgba(205, 127, 50, 0.3)',
          rankIcon: '🥉',
          badgeBg: '#cd7f32',
          badgeColor: '#fff',
        };
      }
      return {
        borderColor: 'divider',
        boxShadow: 'none',
        rankIcon: null,
        badgeBg: 'grey.600',
        badgeColor: 'white',
      };
    }

    // Championship/Semifinal styling
    if (index === 0) {
      return {
        borderColor: '#ffd700',
        boxShadow: '0 4px 20px rgba(255, 215, 0, 0.3)',
        rankIcon: '🥇',
        badgeBg: '#ffd700',
        badgeColor: '#000',
      };
    } else if (index === 1) {
      return {
        borderColor: '#c0c0c0',
        boxShadow: '0 4px 20px rgba(192, 192, 192, 0.2)',
        rankIcon: '🥈',
        badgeBg: '#c0c0c0',
        badgeColor: '#000',
      };
    }
    return {
      borderColor: 'divider',
      boxShadow: 'none',
      rankIcon: null,
      badgeBg: 'primary.main',
      badgeColor: 'white',
    };
  };

  const getTitle = () => {
    if (roundType === 'semifinal') return `Week ${week} Semifinals`;
    if (roundType === 'championship') return `Week ${week} Championship`;
    if (roundType === 'consolation') return `Week ${week} Consolation (3rd Place)`;
    return `Week ${week} Playoffs`;
  };

  const getSubtitle = () => {
    if (roundType === 'semifinal') return 'Top 2 advance to Championship';
    if (roundType === 'championship') return 'Winner takes all';
    if (roundType === 'consolation') return 'Winner claims 3rd place';
    return '';
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1 }}>
          <EmojiEvents sx={{ fontSize: 32, color: roundType === 'consolation' ? '#cd7f32' : 'warning.main' }} />
          {getTitle()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {getSubtitle()}
        </Typography>
      </Box>

      {/* Playoff Cards Grid */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        gap: 3,
      }}>
        {sortedParticipants.map((participant, index) => {
          const isCurrentUser = participant.profile_id === currentUserId;
          const rankStyle = getRankStyle(index);

          return (
            <Paper 
              key={participant.id}
              elevation={isCurrentUser ? 4 : 2}
              sx={{ 
                p: 2.5,
                border: 3,
                borderColor: rankStyle.borderColor,
                boxShadow: rankStyle.boxShadow,
                position: 'relative',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
                ...(isCurrentUser && {
                  background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(66, 165, 245, 0.05) 100%)',
                }),
              }}
            >
              {/* Rank Icon */}
              {rankStyle.rankIcon && (
                <Box sx={{ position: 'absolute', top: -12, right: 20, fontSize: 24 }}>
                  {rankStyle.rankIcon}
                </Box>
              )}

              {/* Header */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Chip 
                    label={`#${participant.seed}`} 
                    size="small" 
                    sx={{ 
                      fontWeight: 700,
                      bgcolor: rankStyle.badgeBg,
                      color: rankStyle.badgeColor,
                    }}
                  />
                  <Typography variant="h6" fontWeight={600} noWrap>
                    {participant.profile?.display_name || participant.profile?.email?.split('@')[0]}
                    {isCurrentUser && (
                      <Chip 
                        label="YOU" 
                        size="small" 
                        color="primary"
                        sx={{ ml: 1, height: 20, '& .MuiChip-label': { px: 1, fontSize: '0.7rem', fontWeight: 700 } }}
                      />
                    )}
                  </Typography>
                </Stack>
                
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h4" fontWeight={700}>
                    {participant.weekPoints}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    pts
                  </Typography>
                </Box>
              </Stack>

              {/* Picks Grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                {[1, 2, 3, 4].map((position) => {
                  const pick = participant.picks.find(p => p.pick_position === position);
                  const gameLocked = pick ? isGameLocked(pick) : false;
                  const isComplete = pick?.game?.status === 'FINAL';
                  const isWin = isComplete && (pick?.points || 0) > 0;

                  return (
                    <Box
                      key={position}
                      sx={{
                        aspectRatio: '1',
                        borderRadius: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        bgcolor: pick 
                          ? (gameLocked ? 'background.paper' : 'rgba(76, 175, 80, 0.1)')
                          : 'grey.800',
                        border: 2,
                        borderColor: pick 
                          ? (gameLocked 
                              ? (isWin ? '#4caf50' : '#f44336')
                              : '#4caf50')
                          : 'grey.700',
                      }}
                    >
                      {pick ? (
                        gameLocked ? (
                          <>
                            <Box
                              component="img"
                              src={pick.team?.logo}
                              alt={pick.team?.abbreviation}
                              sx={{ 
                                width: '70%', 
                                height: '70%', 
                                objectFit: 'contain',
                              }}
                            />
                            {isComplete && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: 2,
                                  right: 2,
                                  bgcolor: isWin ? '#4caf50' : '#f44336',
                                  color: 'white',
                                  px: 0.75,
                                  py: 0.25,
                                  borderRadius: 0.5,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {isWin ? `+${pick.points}` : '0'}
                              </Box>
                            )}
                          </>
                        ) : (
                          <CheckCircle sx={{ fontSize: 28, color: '#4caf50' }} />
                        )
                      ) : (
                        <Lock sx={{ fontSize: 14, color: 'grey.600' }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
