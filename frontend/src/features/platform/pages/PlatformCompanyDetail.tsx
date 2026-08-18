import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BlockIcon from '@mui/icons-material/Block';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DEFAULT_LANDING_PATH } from '../../auth/authApi';
import { ApiError } from '../../../lib/api';
import { EditCompanyDialog } from '../components/EditCompanyDialog';
import { useCompany, useImpersonateCompany, useUpdateCompany } from '../hooks';

export function PlatformCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading, isError } = useCompany(id ?? '');
  const updateCompany = useUpdateCompany();
  const impersonateCompany = useImpersonateCompany();
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return <Typography color="text.secondary">Loading…</Typography>;
  }

  if (isError || !company) {
    return <Typography color="error">Failed to load company.</Typography>;
  }

  const toggleStatus = () =>
    updateCompany.mutate({
      id: company.id,
      status: company.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
    });

  const handleImpersonate = () => {
    impersonateCompany.mutate(company.id, {
      // Same temporary landing target /login uses for any non-SUPER_ADMIN
      // role (DEFAULT_LANDING_PATH) — COMPANY_ADMIN has no real dashboard
      // yet through Day 8. There's no `from` location to return to here
      // the way a real login redirect might have one.
      onSuccess: () => navigate(DEFAULT_LANDING_PATH, { replace: true }),
    });
  };

  const impersonateError =
    impersonateCompany.error instanceof ApiError
      ? impersonateCompany.error
      : undefined;

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {company.name}
        </Typography>
        <Chip
          label={company.status}
          size="small"
          color={company.status === 'ACTIVE' ? 'success' : 'default'}
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Admin email
            </Typography>
            <Typography>{company.admin?.email ?? '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Created
            </Typography>
            <Typography>
              {new Date(company.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
        <Button
          variant="outlined"
          color={company.status === 'ACTIVE' ? 'error' : 'success'}
          startIcon={company.status === 'ACTIVE' ? <BlockIcon /> : <PlayArrowIcon />}
          onClick={toggleStatus}
          disabled={updateCompany.isPending}
        >
          {company.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
        </Button>
        <Tooltip
          title={
            company.status === 'SUSPENDED'
              ? 'Cannot impersonate a suspended company'
              : ''
          }
        >
          {/* span wrapper: Tooltip needs a non-disabled child to attach
              its listeners to, since disabled buttons don't fire events. */}
          <span>
            <Button
              variant="outlined"
              startIcon={<PersonIcon />}
              onClick={handleImpersonate}
              disabled={
                company.status === 'SUSPENDED' || impersonateCompany.isPending
              }
            >
              {impersonateCompany.isPending ? 'Impersonating…' : 'Impersonate'}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {impersonateError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {impersonateError.errors && impersonateError.errors.length > 0
            ? impersonateError.errors.join(', ')
            : impersonateError.message}
        </Alert>
      )}

      {editOpen && (
        <EditCompanyDialog
          company={company}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </Box>
  );
}
