'use client';

import { Box, Paper, Typography } from '@mui/material';

interface Props {
  children: React.ReactNode;
}

export default function DesktopLayout({ children }: Props) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '35% 35% 30%',
        gap: 2,
        p: 2,
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
      }}
    >
      {/* Column 1: Picks */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Picks
        </Typography>
        <Box sx={{ flexGrow: 1 }}>
          {/* My Picks This Week */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              My Picks This Week
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
              No picks yet
            </Typography>
          </Paper>

          {/* League Picks */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              League Picks (Locked)
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
              No locked picks to show
            </Typography>
          </Paper>
        </Box>
      </Paper>

      {/* Column 2: League */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          League
        </Typography>
        <Box sx={{ flexGrow: 1 }}>
          {/* Standings */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Standings
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
              No standings data
            </Typography>
          </Paper>

          {/* Quick Stats */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Quick Stats
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
              No stats available
            </Typography>
          </Paper>
        </Box>
      </Paper>

      {/* Column 3: NFL Games */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          NFL Games
        </Typography>
        <Box sx={{ flexGrow: 1 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              This Week&apos;s Games
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
              No games loaded
            </Typography>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
}
