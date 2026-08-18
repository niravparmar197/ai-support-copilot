import { createTheme } from '@mui/material/styles';

// Scoped to the platform admin area only (see PlatformLayout) — the rest of
// the app stays on Tailwind. Primary color matches the blue-600 already
// used on Tailwind-styled pages (login, forms) so the two don't clash where
// a user moves between them.
export const theme = createTheme({
  palette: {
    primary: { main: '#2563eb' },
  },
  shape: {
    borderRadius: 8,
  },
});
