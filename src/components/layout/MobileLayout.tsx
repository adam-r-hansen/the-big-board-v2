'use client';

import { useState } from 'react';
import { Box, Paper, Tabs, Tab, Typography } from '@mui/material';
import { SportsFootball, Leaderboard, EmojiEvents } from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}
    >
      {value === index && children}
    </Box>
  );
}

interface Props {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: Props) {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Tabs at top */}
      <Paper elevation={1} sx={{ borderRadius: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 48 }}
        >
          <Tab icon={<SportsFootball />} label="Picks" sx={{ minHeight: 48 }} />
          <Tab icon={<Leaderboard />} label="League" sx={{ minHeight: 48 }} />
          <Tab icon={<EmojiEvents />} label="NFL Games" sx={{ minHeight: 48 }} />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={tab} index={0}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Picks
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            My Picks This Week
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
            No picks yet
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            League Picks (Locked)
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
            No locked picks to show
          </Typography>
        </Paper>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          League
        </Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Standings
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
            No standings data
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Quick Stats
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
            No stats available
          </Typography>
        </Paper>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          NFL Games
        </Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            This Week&apos;s Games
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
            No games loaded
          </Typography>
        </Paper>
      </TabPanel>
    </Box>
  );
}
