'use client';

import { Box, Paper, Typography } from '@mui/material';

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
};

interface Props {
  teams: Team[];
  pickedTeams: Map<string, PickInfo>; // team_id -> { week, points }
}

const DIVISIONS = ['West', 'North', 'South', 'East'];

export default function TeamGrid({ teams, pickedTeams }: Props) {
  const getTeamsByConferenceAndDivision = (conference: string, division: string) => {
    return teams.filter(t => t.conference === conference && t.division === division);
  };

  const TeamCard = ({ team }: { team: Team }) => {
    const pickInfo = pickedTeams.get(team.id);
    const isPicked = !!pickInfo;

    return (
      <Paper
        elevation={isPicked ? 2 : 0}
        sx={{
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          bgcolor: isPicked ? team.color_primary : 'action.disabledBackground',
          color: isPicked ? '#fff' : 'text.disabled',
          borderRadius: 1,
          minWidth: 70,
          transition: 'all 0.2s',
        }}
      >
        <Box
          component="img"
          src={team.logo}
          alt={team.short_name}
          sx={{
            width: 36,
            height: 36,
            objectFit: 'contain',
            filter: isPicked ? 'none' : 'grayscale(100%)',
            opacity: isPicked ? 1 : 0.5,
          }}
        />
        <Typography variant="caption" fontWeight={600} sx={{ mt: 0.5 }}>
          {team.abbreviation}
        </Typography>
        {isPicked && (
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            Wk {pickInfo.week} • {pickInfo.points} pts
          </Typography>
        )}
      </Paper>
    );
  };

  const ConferenceSection = ({ conference }: { conference: string }) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        {conference}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        {DIVISIONS.map((division) => (
          <Box key={division} sx={{ flex: 1 }}>
            <Typography 
              variant="caption" 
              color="text.secondary" 
              fontWeight={600}
              sx={{ display: 'block', mb: 1 }}
            >
              {division}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {getTeamsByConferenceAndDivision(conference, division).map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </Box>
          </Box>
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
