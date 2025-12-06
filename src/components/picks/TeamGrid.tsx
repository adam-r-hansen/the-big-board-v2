'use client';

import { Box, Paper, Typography, useMediaQuery, useTheme } from '@mui/material';

type Team = {
  id: string;
  name: string;
  short_name: string;
  abbreviation: string;
  color_primary: string;
  color_secondary: string;
  logo: string;
  conference: string;
  division: string;
};

type PickInfo = {
  week: number;
  points: number;
  status: 'UPCOMING' | 'LIVE' | 'FINAL' | string;
};

interface Props {
  teams: Team[];
  pickedTeams: Map<string, PickInfo>; // team_id -> { week, points, status }
}

const DIVISIONS = ['West', 'North', 'South', 'East'];

export default function TeamGrid({ teams, pickedTeams }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const getTeamsByConferenceAndDivision = (conference: string, division: string) => {
    return teams.filter(t => t.conference === conference && t.division === division);
  };

  const TeamCard = ({ team }: { team: Team }) => {
    const pickInfo = pickedTeams.get(team.id);
    const isPicked = !!pickInfo;
    const isLive = pickInfo?.status === 'LIVE' || pickInfo?.status === 'IN_PROGRESS';
    const isFinal = pickInfo?.status === 'FINAL';
    const isWin = isFinal && (pickInfo?.points ?? 0) > 0;
    const isLoss = isFinal && (pickInfo?.points ?? 0) === 0;

    // Left border color for win/loss
    const getLeftBorderColor = () => {
      if (isWin) return 'success.main';
      if (isLoss) return 'error.main';
      return 'transparent';
    };

    return (
      <Paper
        elevation={isPicked ? 2 : 1}
        sx={{
          p: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: 2,
          borderColor: isPicked ? team.color_primary : 'grey.300',
          borderLeftWidth: 4,
          borderLeftColor: getLeftBorderColor(),
          width: '100%',
          height: isMobile ? 56 : 64,
          transition: 'all 0.2s',
          opacity: isPicked ? 1 : 0.6,
        }}
      >
        {/* Logo container with white background circle */}
        <Box
          sx={{
            width: isMobile ? 36 : 44,
            height: isMobile ? 36 : 44,
            borderRadius: '50%',
            bgcolor: 'white',
            border: 2,
            borderColor: isPicked ? team.color_primary : 'grey.400',
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
            alt={team.short_name}
            sx={{
              width: isMobile ? 24 : 30,
              height: isMobile ? 24 : 30,
              objectFit: 'contain',
              filter: isPicked ? 'none' : 'grayscale(100%)',
            }}
          />
        </Box>

        {/* Right side: Name, Week, Score stacked */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography 
            variant="body2" 
            fontWeight={600} 
            color={isPicked ? 'text.primary' : 'text.disabled'}
            noWrap
            sx={{ fontSize: isMobile ? 11 : 13 }}
          >
            {isMobile ? team.abbreviation : team.short_name}
          </Typography>

          {isPicked && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ fontSize: isMobile ? 9 : 11 }}
              >
                {isLive ? '🔴 LIVE' : `Wk ${pickInfo!.week}`}
              </Typography>
              
              {isFinal && (
                <Typography 
                  variant="caption" 
                  fontWeight={700}
                  color={isWin ? 'success.main' : 'error.main'}
                  sx={{ fontSize: isMobile ? 10 : 12 }}
                >
                  {pickInfo!.points} pts
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Paper>
    );
  };

  const ConferenceSection = ({ conference }: { conference: string }) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        {conference}
      </Typography>
      <Box 
        sx={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
        }}
      >
        {/* Division Headers */}
        {DIVISIONS.map((division) => (
          <Typography 
            key={division}
            variant="caption" 
            color="text.secondary" 
            fontWeight={600}
            sx={{ textAlign: 'center', mb: 0.5 }}
          >
            {division}
          </Typography>
        ))}

        {/* Teams - Row by row */}
        {[0, 1, 2, 3].map((rowIndex) => (
          DIVISIONS.map((division) => {
            const divisionTeams = getTeamsByConferenceAndDivision(conference, division);
            const team = divisionTeams[rowIndex];
            return team ? (
              <TeamCard key={team.id} team={team} />
            ) : (
              <Box key={`${division}-${rowIndex}`} />
            );
          })
        ))}
      </Box>
    </Box>
  );

  return (
    <Box>
      <ConferenceSection conference="NFC" />
      <ConferenceSection conference="AFC" />
    </Box>
  );
}
