import { createTheme } from '@mui/material/styles';

// Helper to generate lighter/darker variants
const adjustColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
};

export type TeamColors = {
  primary: string;
  secondary: string;
} | null;

// Create light theme with optional team colors
export const createLightTheme = (teamColors?: TeamColors) => createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: teamColors?.primary || '#1976d2',
      light: teamColors?.primary ? adjustColor(teamColors.primary, 20) : '#42a5f5',
      dark: teamColors?.primary ? adjustColor(teamColors.primary, -20) : '#1565c0',
    },
    secondary: {
      main: teamColors?.secondary || '#9c27b0',
      light: teamColors?.secondary ? adjustColor(teamColors.secondary, 20) : '#ba68c8',
      dark: teamColors?.secondary ? adjustColor(teamColors.secondary, -20) : '#7b1fa2',
    },
    success: {
      main: '#2e7d32',
    },
    error: {
      main: '#d32f2f',
    },
    warning: {
      main: '#ed6c02',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 500 },
    h2: { fontSize: '2rem', fontWeight: 500 },
    h3: { fontSize: '1.75rem', fontWeight: 500 },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.875rem' },
  },
  shape: {
    borderRadius: 8,
  },
});

// Create dark theme with optional team colors
export const createDarkTheme = (teamColors?: TeamColors) => createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: teamColors?.primary ? adjustColor(teamColors.primary, 15) : '#42a5f5',
      light: teamColors?.primary ? adjustColor(teamColors.primary, 35) : '#80d6ff',
      dark: teamColors?.primary || '#1976d2',
    },
    secondary: {
      main: teamColors?.secondary ? adjustColor(teamColors.secondary, 15) : '#ba68c8',
      light: teamColors?.secondary ? adjustColor(teamColors.secondary, 35) : '#ee98fb',
      dark: teamColors?.secondary || '#9c27b0',
    },
    success: {
      main: '#66bb6a',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ffa726',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 500 },
    h2: { fontSize: '2rem', fontWeight: 500 },
    h3: { fontSize: '1.75rem', fontWeight: 500 },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.875rem' },
  },
  shape: {
    borderRadius: 8,
  },
});

// Default exports for backwards compatibility
export const lightTheme = createLightTheme();
export const darkTheme = createDarkTheme();
