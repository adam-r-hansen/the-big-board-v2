'use client';

import { Box, Paper, Typography, Chip, ButtonBase } from '@mui/material';
import { Stars, CheckCircle, Add, Lock } from '@mui/icons-material';

type Team = {
  id: string;
  short_name: string;
  abbreviation: string;
  color_primary: string;
  logo: string;
};

type Game = {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  game_utc: string;
  status: string;
  home: Team;
  away: Team;
};

type Wrinkle = {
  id: string;
  name: string;
  kind: string;
  week: number;
  spread: number | null;
  spread_team_id: string | null;
  config: any;
  game: Game | null;
};

type WrinklePick = {
  id: string;
  wrinkle_id: string;
  team_id: string;
  points: number;
  selection: any;
};

interface Props {
  wrinkle: Wrinkle;
  pick?: WrinklePick;
  onSelectTeam: (teamId: string) => void;
  disabled?: boolean;
}

export default function WrinkleCard({ wrinkle, pick, onSelectTeam, disabled }: Props) {
  const { game } = wrinkle;
  
  // If no game attached (like winless_double), don't render as a game card
  if (!game) {
    return (
      <Paper
        elevation={2}
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          border: 2,
          borderColor: 'secondary.main',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            bgcolor: 'secondary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Stars fontSize="small" />
            <Typography variant="subtitle2" fontWeight={700}>
              {wrinkle.name}
            </Typography>
          </Box>
          <Chip
            label={getKindLabel(wrinkle.kind)}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', height: 22 }}
          />
        </Box>
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {wrinkle.kind === 'winless_double' 
              ? 'Pick a winless team in your regular picks - if they win, your points are doubled!'
              : 'Special wrinkle - no game selection needed'}
          </Typography>
        </Box>
      </Paper>
    );
  }

  const gameTime = new Date(game.game_utc);
  const isLocked = gameTime < new Date();
  const isComplete = game.status === 'FINAL';
  const isLive = game.status === 'LIVE' || game.status === 'IN_PROGRESS';

  const formatGameTime = () => {
    return gameTime.toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const TeamRow = ({ team, isHome }: { team: Team; isHome: boolean }) => {
    const isSelected = pick?.team_id === team.id;
    const score = isHome ? game.home_score : game.away_score;
    const opponentScore = isHome ? game.away_score : game.home_score;
    const isWinning = (score ?? 0) > (opponentScore ?? 0);
    const isFinalWin = isComplete && isWinning && isSelected;
    const isFinalLoss = isComplete && !isWinning && isSelected;
    const canSelect = !isLocked && !disabled;

    // Show spread for ATS
    const showSpread = wrinkle.kind === 'bonus_game_ats' && wrinkle.spread;
    const teamSpread = wrinkle.spread_team_id === team.id 
      ? wrinkle.spread 
      : wrinkle.spread ? -wrinkle.spread : null;

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
          borderLeft: 4,
          borderColor: isSelected 
            ? isFinalWin ? 'success.main' : isFinalLoss ? 'error.main' : 'secondary.main'
            : 'transparent',
          bgcolor: isSelected ? 'action.selected' : 'transparent',
          transition: 'all 0.15s',
          '&:hover': canSelect ? { bgcolor: 'action.hover' } : {},
        }}
      >
        {/* Logo */}
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'white',
            border: 2,
            borderColor: team.color_primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 1,
            mr: 1.5,
          }}
        >
          <Box
            component="img"
            src={team.logo}
            alt={team.abbreviation}
            sx={{ width: 28, height: 28, objectFit: 'contain' }}
          />
        </Box>

        {/* Team Name + Spread */}
        <Box sx={{ flexGrow: 1, textAlign: 'left' }}>
          <Typography variant="body1" fontWeight={isSelected ? 700 : 500}>
            {team.short_name}
          </Typography>
          {showSpread && teamSpread !== null && (
            <Typography variant="caption" color="text.secondary">
              {teamSpread > 0 ? '+' : ''}{teamSpread}
            </Typography>
          )}
        </Box>

        {/* Score or Status */}
        {(isComplete || isLive) && score !== null ? (
          <Typography 
            variant="h6" 
            fontWeight={700}
            color={isSelected ? (isFinalWin ? 'success.main' : 'error.main') : 'text.primary'}
          >
            {score}
          </Typography>
        ) : isSelected ? (
          <CheckCircle color="secondary" />
        ) : canSelect ? (
          <Add color="action" />
        ) : null}
      </ButtonBase>
    );
  };

  return (
    <Paper
      elevation={2}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: 2,
        borderColor: 'secondary.main',
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'secondary.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Stars fontSize="small" />
          <Typography variant="subtitle2" fontWeight={700}>
            {wrinkle.name}
          </Typography>
        </Box>
        <Chip
          label={getKindLabel(wrinkle.kind)}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', height: 22 }}
        />
      </Box>

      {/* Game Time */}
      <Box sx={{ px: 2, py: 0.75, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {isLive ? '🔴 LIVE' : isComplete ? 'FINAL' : formatGameTime()}
        </Typography>
        {isLocked && !isComplete && !isLive && <Lock fontSize="small" color="disabled" sx={{ fontSize: 14 }} />}
      </Box>

      {/* Teams */}
      <Box sx={{ p: 1 }}>
        <TeamRow team={game.away} isHome={false} />
        <TeamRow team={game.home} isHome={true} />
      </Box>

      {/* Points earned */}
      {pick && isComplete && (
        <Box sx={{ px: 2, py: 1, bgcolor: pick.points > 0 ? 'success.light' : 'error.light' }}>
          <Typography variant="body2" fontWeight={700} color={pick.points > 0 ? 'success.dark' : 'error.dark'}>
            {pick.points > 0 ? `+${pick.points} bonus points!` : 'No bonus points'}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function getKindLabel(kind: string) {
  switch (kind) {
    case 'bonus_game': return 'Bonus Pick';
    case 'bonus_game_ats': return 'Against the Spread';
    case 'bonus_game_ou': return 'Over/Under';
    case 'bonus_game_oof': return 'Bonus Pick';
    case 'winless_double': return 'Winless Double';
    default: return 'Bonus';
  }
}
