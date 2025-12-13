'use client';

import { Box, Paper, Typography, Divider, IconButton, Chip, useTheme } from '@mui/material';
import { 
  AddCircleOutline,
  CheckCircle,
  Lock,
  Schedule,
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

type PickData = {
  points: number;
  multiplier: number;
};

interface Props {
  game: Game;
  selectedTeamId?: string;
  usedTeams: Set<string>;
  onSelectTeam: (teamId: string) => void;
  disabled?: boolean;
  isLocked?: boolean;
  pickData?: PickData;
}

// Helper to determine if a color is light or dark
const isLightColor = (hex: string): boolean => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
};

export default function GameCard({ 
  game, 
  selectedTeamId, 
  usedTeams, 
  onSelectTeam,
  disabled,
  isLocked: forceLocked,
  pickData,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const gameTime = new Date(game.game_utc);
  const now = new Date();
  const isLocked = forceLocked || gameTime < now;
  const isComplete = game.status === 'FINAL';
  const isLive = game.status === 'LIVE' || game.status === 'IN_PROGRESS';

  // Determine picked team details
  const pickedTeam = selectedTeamId === game.home.id ? game.home : 
                     selectedTeamId === game.away.id ? game.away : null;
  
  // Calculate win/loss for picked team
  const pickedIsHome = selectedTeamId === game.home.id;
  const pickedScore = pickedIsHome ? game.home_score : game.away_score;
  const opponentScore = pickedIsHome ? game.away_score : game.home_score;
  const isWin = isComplete && pickedTeam && (pickedScore ?? 0) > (opponentScore ?? 0);
  const isLoss = isComplete && pickedTeam && (pickedScore ?? 0) < (opponentScore ?? 0);

  // Get actual points (from pickData if available, otherwise calculate)
  const actualPoints = pickData?.points ?? (isWin ? pickedScore : 0);
  const multiplier = pickData?.multiplier ?? 1;

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
    const canSelect = !isLocked && !isUsedElsewhere && !disabled;

    // Determine background color
    const getBgColor = () => {
      if (isSelected) return team.color_primary;
      return 'transparent';
    };

    // Determine text color based on background
    const getTextColor = () => {
      if (isSelected) {
        return isLightColor(team.color_primary) ? '#000000' : '#ffffff';
      }
      if (isUsedElsewhere) return 'text.disabled';
      return 'text.primary';
    };

    const bgColor = getBgColor();
    const textColor = getTextColor();

    return (
      <Box
        onClick={() => canSelect && onSelectTeam(team.id)}
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: canSelect ? 'pointer' : 'default',
          opacity: isUsedElsewhere ? 0.45 : (selectedTeamId && !isSelected) ? 0.5 : 1,
          bgcolor: bgColor,
          transition: 'all 0.2s ease',
          '&:hover': canSelect ? {
            bgcolor: isSelected ? bgColor : 'action.hover',
          } : {},
        }}
      >
        {/* Team Logo */}
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: 'white',
              border: 2,
              borderColor: isUsedElsewhere ? 'grey.500' : team.color_primary,
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
          {/* Checkmark badge for selected team */}
          {isSelected && (
            <Box
              sx={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                bgcolor: 'success.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid',
                borderColor: 'background.paper',
              }}
            >
              <CheckCircle sx={{ fontSize: 14 }} />
            </Box>
          )}
          {/* x2 badge for multiplier */}
          {isSelected && multiplier > 1 && (
            <Box
              sx={{
                position: 'absolute',
                top: -4,
                right: -8,
                px: 0.5,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'secondary.main',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                border: '2px solid',
                borderColor: 'background.paper',
              }}
            >
              x{multiplier}
            </Box>
          )}
        </Box>

        {/* Team Name */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography 
            variant="body1" 
            fontWeight={isSelected ? 700 : 500}
            sx={{ color: textColor }}
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
            sx={{ 
              color: isSelected ? textColor : 'text.primary',
              opacity: isSelected ? 1 : 0.7,
            }}
          >
            {score}
          </Typography>
        )}

        {/* Action button for unselected teams */}
        {!isSelected && !isComplete && !isLive && (
          canSelect ? (
            <IconButton 
              size="small"
              sx={{ 
                border: 2, 
                borderColor: team.color_primary,
                color: team.color_primary,
                '&:hover': {
                  bgcolor: `${team.color_primary}15`,
                }
              }}
            >
              <AddCircleOutline />
            </IconButton>
          ) : isUsedElsewhere ? null : (
            <Lock color="disabled" sx={{ fontSize: 20 }} />
          )
        )}
      </Box>
    );
  };

  return (
    <Paper
      elevation={selectedTeamId ? 3 : 1}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: 2,
        borderColor: pickedTeam ? pickedTeam.color_primary : 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Game Header */}
      <Box 
        sx={{ 
          px: 2, 
          py: 1, 
          bgcolor: isLive ? 'error.main' : isDark ? 'grey.800' : 'grey.100',
          color: isLive ? 'white' : 'text.secondary',
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
        
        {/* Win/Loss indicator with multiplier */}
        {isComplete && pickedTeam && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {multiplier > 1 && (
              <Chip 
                label={`x${multiplier}`} 
                size="small" 
                color="secondary"
                sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
              />
            )}
            <Typography 
              variant="caption" 
              fontWeight={700}
              sx={{ 
                color: isWin ? 'success.main' : 'error.main',
              }}
            >
              {isWin ? '✓ WIN' : 'LOSS'}
            </Typography>
          </Box>
        )}
        
        {isLocked && !isComplete && !isLive && (
          <Lock sx={{ fontSize: 14, opacity: 0.7 }} />
        )}
      </Box>

      {/* Away Team */}
      <TeamRow team={game.away} isHome={false} />
      
      {/* Divider with @ symbol */}
      <Divider>
        <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
          @
        </Typography>
      </Divider>

      {/* Home Team */}
      <TeamRow team={game.home} isHome={true} />

      {/* Points Footer (for completed picks) */}
      {isComplete && pickedTeam && (
        <Box
          sx={{
            py: 1,
            px: 2,
            bgcolor: isWin 
              ? (isDark ? 'success.dark' : 'success.light')
              : (isDark ? 'error.dark' : 'error.light'),
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Typography 
            variant="body2" 
            fontWeight={700}
            sx={{ 
              color: isWin 
                ? (isDark ? 'success.light' : 'success.dark')
                : (isDark ? 'error.light' : 'error.dark'),
            }}
          >
            {isWin ? `+${actualPoints} pts` : '0 pts'}
          </Typography>
          {isWin && multiplier > 1 && (
            <Typography 
              variant="caption"
              sx={{ 
                color: isWin 
                  ? (isDark ? 'success.light' : 'success.dark')
                  : (isDark ? 'error.light' : 'error.dark'),
                opacity: 0.8,
              }}
            >
              ({pickedScore} × {multiplier})
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}
