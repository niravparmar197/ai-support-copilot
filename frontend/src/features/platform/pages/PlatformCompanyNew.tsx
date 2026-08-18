import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ApiError } from '../../../lib/api';
import { useCreateCompany } from '../hooks';

export function PlatformCompanyNew() {
  const navigate = useNavigate();
  const createCompany = useCreateCompany();

  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createCompany.mutate(
      { companyName, adminName, adminEmail, temporaryPassword },
      {
        onSuccess: (result) => {
          navigate(`/platform/companies/${result.tenant.id}`);
        },
      },
    );
  };

  const error =
    createCompany.error instanceof ApiError ? createCompany.error : undefined;

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        New Company
      </Typography>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <TextField
              label="Company Name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Admin Name"
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Admin Email"
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Temporary Password"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
              required
              slotProps={{ htmlInput: { minLength: 12 } }}
              helperText="At least 12 characters."
              fullWidth
            />

            {error && (
              <Alert severity="error">
                {error.errors && error.errors.length > 0
                  ? error.errors.join(', ')
                  : error.message}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={createCompany.isPending}
            >
              Create Company
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
