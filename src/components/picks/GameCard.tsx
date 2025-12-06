'use client';

import { Box, Paper, Typography, Chip, Divider } from '@mui/material';
import { 
  AddCircle, 
  CheckCircle, 
  Cancel, 
  Lock, 
  Block,
  Schedule,
  TrendingUp,
  TrendingDown,
  Circle,
} from '@mui/icons-material';

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

  const TeamRow = ({ team, opponent, isHome }: { team: Team; opponent: Team; isHome: boolean }) => {
    const isSelected = selectedTeamId === team.id;
    const isUsedElsewhere = usedTeams.has(team.id) && !isSelected;
    const score = isHome ? game.home_score : game.away_score;
    const opponentScore = isHome ? game.away_score : game.home_score;
    const isWinning = (score ?? 0) > (opponentScore ?? 0);
    const isLosing = (score ?? 0) < (opponentScore ?? 0);
    const isFinalWin = isComplete && isWinning;
    const isFinalLoss = isComplete && isLosing;
    const canSelect = !isLocked && !isUsedElsewhere && !disabled;

    // Determine border color
    const getBorderColor = () => {
      if (isUsedElsewhere) return 'grey.400';
      if (isFinalWin) return 'success.main';
      if (isFinalLoss) return 'error.main';
      if (isLive && isWinning) return 'success.main';
      if (isLive && isLosing) return 'error.main';
      if (isSelected) return 'success.main';
      return 'transparent';
    };

    // Determine status chip
    const getStatus = () => {
      if (isUsedElsewhere) return { label: 'Used', color: 'default' as const, icon: <Block sx={{ fontSize: 14 }} /> };
      if (isFinalWin) return { label: 'Won', color: 'success' as const, icon: <TrendingUp sx={{ fontSize: 14 }} /> };
      if (isFinalLoss) return { label: 'Lost', color: 'error' as const, icon: <TrendingDown sx={{ fontSize: 14 }} /> };
      if (isLive && isWinning) return { label: 'Winning', color: 'success' as const, icon: <TrendingUp sx={{ fontSize: 14 }} /> };
      if (isLive && isLosing) return { label: 'Losing', color: 'error' as const, icon: <TrendingDown sx={{ fontSize: 14 }} /> };
      if (isSelected) return { label: 'Picked', color: 'success' as const, icon: <CheckCircle sx={{ fontSize: 14 }} /> };
      return null;
    };

    const status = getStatus();

    return (
      <Box
        onClick={() => canSelect && onSelectTeam(team.id)}
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderLeft: 4,
          borderColor: getBorderColor(),
          cursor: canSelect ? 'pointer' : 'default',
          opacity: isUsedElsewhere ? 0.5 : 1,
          bgcolor: isSelected ? 'action.selected' : 'transparent',
          borderRadius: 1,
          transition: 'all 0.15s ease',
          '&:hover': canSelect ? {
            bgcolor: 'action.hover',
          } : {},
        }}
      >
        {/* Team Logo with white background circle */}
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            bgcolor: 'white',
            border: 2,
            borderColor: isUsedElsewhere ? 'grey.300' : team.color_primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 1,
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src={team.logo}
            alt={team.abbreviation}
            sx={{
              width: 30,
              height: 30,
              objectFit: 'contain',
              filter: isUsedElsewhere ? 'grayscale(100%)' : 'none',
            }}
          />
        </Box>

        {/* Team Name */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography 
            variant="body1" 
            fontWeight={isSelected ? 700 : 500}
            color={isUsedElsewhere ? 'text.disabled' : 'text.primary'}
            noWrap
          >
            {team.short_name}
          </Typography>
          {isUsedElsewhere && (
            <Typography variant="caption" color="text.disabled">
              Already used
            </Typography>
          )}
        </Box>

        {/* Score (if game started) */}
        {(isComplete || isLive) && score !== null && (
          <Typography 
            variant="h5" 
            fontWeight={700}
            color={
              isSelected 
                ? (isFinalWin || isWinning ? 'success.main' : 'error.main')
                : 'text.primary'
            }
          >
            {score}
          </Typography>
        )}

        {/* Status chip or action icon */}
        {status ? (
          <Chip
            icon={status.icon || undefined}
            label={status.label}
            size="small"
            color={status.color}
            variant={status.color === 'default' ? 'outlined' : 'filled'}
            sx={{ height: 24, fontSize: 11 }}
          />
        ) : canSelect ? (
          <AddCircle color="primary" />
        ) : !isComplete && !isLive ? (
          <Lock color="disabled" sx={{ fontSize: 20 }} />
        ) : null}
      </Box>
    );
  };

  return (
    <Paper
      elevation={selectedTeamId ? 2 : 1}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: selectedTeamId ? 2 : 1,
        borderColor: selectedTeamId ? 'primary.main' : 'divider',
      }}
    >
      {/* Game Header */}
      <Box 
        sx={{ 
          px: 2, 
          py: 1, 
          bgcolor: isLive ? 'error.main' : isComplete ? 'grey.800' : 'grey.100',
          color: isLive || isComplete ? 'white' : 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography 
          variant="caption" 
          fontWeight={600}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          {isLive ? (
            <>
              <Circle sx={{ fontSize: 8 }} />
              LIVE
            </>
          ) : (
            <>
              <Schedule sx={{ fontSize: 14 }} />
              {isComplete ? 'FINAL' : formatGameTime()}
            </>
          )}
        </Typography>
        {isLocked && !isComplete && !isLive && (
          <Lock sx={{ fontSize: 14, opacity: 0.7 }} />
        )}
      </Box>

      {/* Away Team */}
      <TeamRow team={game.away} opponent={game.home} isHome={false} />
      
      {/* Divider with @ symbol */}
      <Divider>
        <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
          @
        </Typography>
      </Divider>

      {/* Home Team */}
      <TeamRow team={game.home} opponent={game.away} isHome={true} />
    </Paper>
  );
}
