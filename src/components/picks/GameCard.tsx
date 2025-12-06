'use client';

import { Box, Paper, Typography, ButtonBase } from '@mui/material';
import { Lock, CheckCircle } from '@mui/icons-material';

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
  week: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  game_utc: string;
  status: string;
  home: Team;
  away: Team;
};

interface Props {
  game: Game;
  selectedTeamId?: string;
  usedTeams: Set<string>;
  onSelectTeam: (teamId: string) => void;
  disabled?: boolean;
  isLocked?: boolean;
}

export default function GameCard({ 
  game, 
  selectedTeamId, 
  usedTeams, 
  onSelectTeam,
  disabled,
  isLocked: forceLocked,
}: Props) {
  const gameTime = new Date(game.game_utc);
  const now = new Date();
  const isLocked = forceLocked || gameTime < now;
  const isComplete = game.status === 'FINAL';
  const isLive = game.status === 'LIVE' || game.status === 'IN_PROGRESS';

  const formatGameTime = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[gameTime.getDay()];
    const time = gameTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    return `${day} ${time}`;
  };

  const TeamRow = ({ team, isHome }: { team: Team; isHome: boolean }) => {
    const isSelected = selectedTeamId === team.id;
    const isUsedElsewhere = usedTeams.has(team.id) && !isSelected;
    const score = isHome ? game.home_score : game.away_score;
    const opponentScore = isHome ? game.away_score : game.home_score;
    const isWinner = isComplete && score !== null && opponentScore !== null && score > opponentScore;
    const canSelect = !isLocked && !isUsedElsewhere && !disabled;

    return (
      <ButtonBase
        onClick={() => canSelect && onSelectTeam(team.id)}
        disabled={!canSelect}
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          p: 1.5,
          borderRadius: 1,
          transition: 'all 0.15s',
          bgcolor: isSelected 
            ? isComplete 
              ? isWinner ? 'success.main' : 'error.main'
              : team.color_primary 
            : 'transparent',
          color: isSelected ? '#fff' : isUsedElsewhere ? 'text.disabled' : 'text.primary',
          opacity: isUsedElsewhere && !isSelected ? 0.4 : 1,
          '&:hover': canSelect ? {
            bgcolor: isSelected ? team.color_primary : 'action.hover',
          } : {},
        }}
      >
        <Box
          component="img"
          src={team.logo}
          alt={team.short_name}
          sx={{
            width: 32,
            height: 32,
            objectFit: 'contain',
            mr: 1.5,
            filter: isUsedElsewhere && !isSelected ? 'grayscale(100%)' : 'none',
          }}
        />
        <Typography 
          variant="body1" 
          fontWeight={isSelected || isWinner ? 700 : 500}
          sx={{ flexGrow: 1, textAlign: 'left' }}
        >
          {team.short_name}
        </Typography>
        
        {/* Score or Status */}
        {(isComplete || isLive) && score !== null ? (
          <Typography variant="body1" fontWeight={700}>
            {score}
          </Typography>
        ) : isUsedElsewhere ? (
          <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
            USED
          </Typography>
        ) : isSelected && isLocked ? (
          <CheckCircle fontSize="small" sx={{ opacity: 0.8 }} />
        ) : null}
      </ButtonBase>
    );
  };

  return (
    <Paper 
      elevation={selectedTeamId ? 2 : 1} 
      sx={{ 
        overflow: 'hidden',
        border: selectedTeamId ? 2 : 0,
        borderColor: 'primary.main',
      }}
    >
      {/* Game Time Header */}
      <Box 
        sx={{ 
          px: 1.5, 
          py: 0.75, 
          bgcolor: isLive ? 'error.dark' : 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography 
          variant="caption" 
          color={isLive ? 'white' : 'text.secondary'}
          fontWeight={isLive ? 600 : 400}
        >
          {isLive ? '🔴 LIVE' : isComplete ? 'FINAL' : formatGameTime()}
        </Typography>
        {isLocked && !isComplete && !isLive && (
          <Lock fontSize="small" color="disabled" sx={{ fontSize: 14 }} />
        )}
      </Box>

      {/* Teams */}
      <Box sx={{ p: 0.5 }}>
        <TeamRow team={game.away} isHome={false} />
        <TeamRow team={game.home} isHome={true} />
      </Box>
    </Paper>
  );
}
