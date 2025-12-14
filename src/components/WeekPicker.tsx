'use client';

import { useState } from 'react';
import { Box, IconButton, Typography, Menu, MenuItem, Stack } from '@mui/material';
import { ChevronLeft, ChevronRight, ExpandMore } from '@mui/icons-material';

type WeekPickerProps = {
  currentWeek: number;
  viewingWeek: number;
  onWeekChange: (week: number) => void;
};

export default function WeekPicker({ currentWeek, viewingWeek, onWeekChange }: WeekPickerProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleWeekSelect = (week: number) => {
    onWeekChange(week);
    handleClose();
  };

  const changeWeek = (delta: number) => {
    const newWeek = Math.max(1, Math.min(18, viewingWeek + delta));
    if (newWeek !== viewingWeek) {
      onWeekChange(newWeek);
    }
  };

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
      <Box
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          '&:hover': { opacity: 0.7 },
        }}
      >
        <Typography variant="h6" fontWeight={700}>
          Week {viewingWeek}
        </Typography>
        <ExpandMore fontSize="small" />
      </Box>

      <Stack direction="row" spacing={0.5}>
        <IconButton size="small" onClick={() => changeWeek(-1)} disabled={viewingWeek <= 1}>
          <ChevronLeft />
        </IconButton>
        <IconButton size="small" onClick={() => changeWeek(1)} disabled={viewingWeek >= 18}>
          <ChevronRight />
        </IconButton>
      </Stack>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {Array.from({ length: 18 }, (_, i) => i + 1).map((week) => (
          <MenuItem
            key={week}
            onClick={() => handleWeekSelect(week)}
            selected={week === viewingWeek}
            sx={{
              fontWeight: week === currentWeek ? 700 : 400,
              color: week === currentWeek ? 'primary.main' : 'inherit',
            }}
          >
            Week {week} {week === currentWeek && '(Current)'}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}
