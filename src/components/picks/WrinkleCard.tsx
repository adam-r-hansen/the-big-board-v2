'use client';

import { useEffect, useState } from 'react';
import { Box, Paper, Typography, Chip, ButtonBase, CircularProgress } from '@mui/material';
import Grid from '@mui/material/Grid2';
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
  const [oofGames, setOofGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    if (wrinkle.kind !== 'bonus_game_oof') return;

    const loadOofGames = async () => {
      setLoadingGames(true);
      try {
        const res = await fetch(`/api/wrinkles/${wrinkle.id}/games`);
        const data = await res.json();
        if (data.games) {
          setOofGames(data.games);
        }
      } catch (err) {
        console.error('Failed to load OOF games:', err);
      } finally {
        setLoadingGames(false);
      }
    };

    loadOofGames();
  }, [wrinkle.id, wrinkle.kind]);

  if (wrinkle.kind === 'bonus_game_oof') {
    return (
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', border: 2, borderColor: 'secondary.main' }}>
        <Box sx={{ px: 2, py: 1, bgcolor: 'secondary.main', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Stars fontSize="small" />
            <Typography variant="subtitle2" fontWeight={700}>{wrinkle.name}</Typography>
          </Box>
          <Chip label="Bonus Pick" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
        </Box>

        <Box sx={{ p: 2 }}>
          {loadingGames ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Grid container spacing={1}>
              {oofGames.flatMap(game => [
                { game, team: game.home, isHome: true },
                { game, team: game.away, isHome: false },
              ])
                .filter(({ team }) => wrinkle.config?.oof_team_ids?.includes(team.id))
                .map(({ game, team, isHome }) => {
                  const isSelected = pick?.team_id === team.id;
                  const canSelect = !disabled && new Date(game.game_utc) > new Date();

                  return (
                    <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`${game.id}-${team.id}`}>
                      <ButtonBase
                        onClick={() => canSelect && onSelectTeam(team.id)}
                        disabled={!canSelect}
                        sx={{
                          width: '100%',
                          p: 1.5,
                          borderRadius: 1,
                          border: 2,
                          borderColor: isSelected ? 'secondary.main' : 'grey.300',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                      >
                        <Box component="img" src={team.logo} alt={team.abbreviation} sx={{ width: 32, height: 32 }} />
                        <Typography variant="caption">{team.abbreviation}</Typography>
                        {isSelected && <CheckCircle color="secondary" fontSize="small" />}
                      </ButtonBase>
                    </Grid>
                  );
                })}
            </Grid>
          )}
        </Box>
      </Paper>
    );
  }

  return null;
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
