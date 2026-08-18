import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { ApiError } from '../../../lib/api';
import { useCreateUser } from '../hooks';

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateUserDialog({ open, onClose }: CreateUserDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const createUser = useCreateUser();

  const handleClose = () => {
    setName('');
    setEmail('');
    setTemporaryPassword('');
    createUser.reset();
    onClose();
  };

  const handleCreate = () => {
    createUser.mutate(
      { name, email, temporaryPassword },
      { onSuccess: handleClose },
    );
  };

  const error =
    createUser.error instanceof ApiError ? createUser.error : undefined;
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    temporaryPassword.length >= 12;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>New Support User</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Temporary Password"
            type="password"
            fullWidth
            helperText="At least 12 characters — the user resets it on first login."
            value={temporaryPassword}
            onChange={(event) => setTemporaryPassword(event.target.value)}
          />
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error.errors && error.errors.length > 0
              ? error.errors.join(', ')
              : error.message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={!canSubmit || createUser.isPending}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
