'use client';

import { Box, Paper, Typography, useTheme } from '@mui/material';
import { Schedule, Circle, Lock, CheckCircle, AddCircleOutline } from '@mui/icons-material';

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
  selectedTeamId?: string | null;
  onSelectTeam: (gameId: string, teamId: string | null) => void;
  disabled?: boolean;
  isLocked?: boolean;
  isTaken?: boolean;
  takenTeamIds?: Set<string>;
}

// Helper to determine if a color is light or dark
function isLightColor(color: string): boolean {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}

export default function PlayoffGameCard({
  game,
  selectedTeamId,
  onSelectTeam,
  disabled = false,
  isLocked = false,
  takenTeamIds = new Set(),
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const gameTime = new Date(game.game_utc);
  const gameStarted = gameTime <= new Date();
  const isComplete = game.status === 'FINAL' || game.status === 'final';
  const isLive = game.status === 'LIVE' || game.status === 'IN_PROGRESS';

  const pickedTeam = selectedTeamId === game.home.id ? game.home : selectedTeamId === game.away.id ? game.away : null;

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
    const isTeamTaken = takenTeamIds.has(team.id);
    const score = isHome ? game.home_score : game.away_score;
    const canSelect = !isLocked && !gameStarted && !disabled && !isTeamTaken;
    const canUnpick = !isLocked && !gameStarted && !disabled && isSelected;

    const handleClick = () => {
      if (canUnpick) {
        // Unpick by passing null as teamId
        onSelectTeam(game.id, null);
      } else if (canSelect) {
        // Pick this team
        onSelectTeam(game.id, team.id);
      }
    };

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
      if (isTeamTaken) return 'text.disabled';
      return 'text.primary';
    };

    const bgColor = getBgColor();
    const textColor = getTextColor();

    return (
      <Box
        onClick={handleClick}
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: (canSelect || canUnpick) ? 'pointer' : 'default',
          opacity: isTeamTaken ? 0.45 : (selectedTeamId && !isSelected) ? 0.5 : 1,
          bgcolor: bgColor,
          transition: 'all 0.2s ease',
          '&:hover': (canSelect || canUnpick) ? {
            bgcolor: isSelected ? bgColor : 'action.hover',
            opacity: isSelected ? 0.9 : 1,
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
              borderColor: isTeamTaken ? 'grey.500' : team.color_primary,
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
                filter: isTeamTaken ? 'grayscale(100%)' : 'none',
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
          {isTeamTaken && (
            <Typography variant="caption" color="text.disabled">
              Already picked
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
            <AddCircleOutline sx={{ color: team.color_primary }} />
          ) : (
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
      </Box>

      {/* Team Rows */}
      <TeamRow team={game.away} isHome={false} />
      <Box sx={{ height: 1, bgcolor: 'divider' }} />
      <TeamRow team={game.home} isHome={true} />
    </Paper>
  );
}
