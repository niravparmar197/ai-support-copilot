import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCurrentUser } from '../../auth/hooks';

export function PlatformProfile() {
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return <Typography color="text.secondary">Loading…</Typography>;
  }

  if (isError || !user) {
    return <Typography color="error">Failed to load profile.</Typography>;
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Profile
      </Typography>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 3 }}>
          <Avatar sx={{ width: 56, height: 56, fontSize: 22 }}>
            {user.email[0]?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {user.email}
            </Typography>
            <Chip label={user.role} size="small" sx={{ mt: 0.5 }} />
          </Box>
        </Stack>

        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Typography>{user.status}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Account created
            </Typography>
            <Typography>
              {new Date(user.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
