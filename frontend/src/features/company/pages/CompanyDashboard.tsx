import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useCompanyDashboard } from '../hooks';
import type { CompanyDashboard as CompanyDashboardData } from '../dashboardApi';

const TILES: { key: keyof CompanyDashboardData; label: string }[] = [
  { key: 'totalUsers', label: 'Users' },
  { key: 'totalCustomers', label: 'Customers' },
  { key: 'totalTickets', label: 'Tickets' },
  { key: 'totalDocuments', label: 'Documents' },
  { key: 'totalAiRequests', label: 'AI Requests' },
];

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, minWidth: 140 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Paper>
  );
}

export function CompanyDashboard() {
  const { data, isLoading, isError } = useCompanyDashboard();

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Dashboard
      </Typography>

      {isLoading && <Typography color="text.secondary">Loading…</Typography>}
      {isError && (
        <Typography color="error">Failed to load dashboard.</Typography>
      )}

      {data && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {TILES.map((tile) => (
            <StatTile key={tile.key} label={tile.label} value={data[tile.key]} />
          ))}
        </Box>
      )}
    </Box>
  );
}
